"""REST API server for llama-launcher UI frontend.

Bridges the React frontend (on port 9090 static assets) to the Python
backend (process management, config, model detection).

Usage:
    python -m backend.api_server [--port 8501] [--host 127.0.0.1]
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Dict, Optional

from backend.config import LlamaConfig, load_config
from backend.model_manager import ModelManager, scan_local_models, download_model
from backend.process_manager import ProcessManager
from backend.llama_runner import LlamaRunner
from backend.logger import get_logger
from backend import daemon as daemon_module, gpu_detector

logger = get_logger(__name__)

_config = None
_process_manager = None
_model_manager = None
_runner = None
_metrics_history: list[dict[str, Any]] = []
_metrics_history_lock = threading.Lock()
_MAX_METRICS_HISTORY = 500
_gpu_initialized = False


def _ensure_instantiated():
    global _config, _process_manager, _model_manager, _runner
    if _config is None:
        _config = load_config()
    if _process_manager is None:
        _process_manager = ProcessManager(_config)
    if _model_manager is None:
        _model_manager = ModelManager(_config)
    if _runner is None:
        _runner = LlamaRunner(_config)


def _init_gpu_detection():
    """Detect active GPU backend and log it (runs once via _gpu_initialized guard)."""
    global _gpu_initialized
    if _gpu_initialized:
        return
    _gpu_initialized = True
    try:
        gpus = gpu_detector.detect_gpu()
        backend = gpu_detector.get_active_backend()
        if backend:
            logger.info("GPU backend active: %s (%d device(s))", backend, len(gpus))
        else:
            logger.info("No GPU hardware or drivers detected — running in CPU-only mode")
    except Exception:
        logger.debug("GPU detection logging failed", exc_info=True)


class APIHandler(BaseHTTPRequestHandler):

    def _send_json(self, status, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        try:
            if path == "/models":
                self._handle_get_models()
            elif path == "/models/types":
                self._handle_get_model_types()
            elif path.startswith("/models/") and path.count("/") == 2:
                self._handle_get_model_by_id(path)
            elif path == "/models/resolve":
                self._handle_get_model_resolve()
            elif path == "/models/quantizations":
                self._handle_get_model_quantizations()
            elif path == "/servers" or path.startswith("/servers/"):
                self._handle_get_servers(path)
            elif path == "/settings":
                self._handle_get_settings()
            elif path == "/logs":
                self._handle_get_logs()
            elif path == "/metrics":
                self._handle_get_metrics()
            elif path == "/metrics/history":
                self._handle_get_metrics_history()
            elif path == "/metrics/gpu":
                self._handle_get_metrics_gpu()
            elif path == "/health":
                self._handle_get_health()
            elif path == "/daemon/status":
                self._handle_get_daemon_status()
            elif path == "/daemon/logs":
                self._handle_get_daemon_logs()
            elif path == "/daemon/service":
                self._handle_get_daemon_service()
            else:
                self._send_json(404, {"error": f"Not found: {self.path}"})
        except Exception as e:
            logger.exception("GET %s failed", self.path)
            self._send_json(500, {"error": str(e)})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        try:
            if path == "/servers":
                self._handle_post_server()
            elif path == "/models":
                self._handle_post_model()
            elif path == "/models/download":
                self._handle_post_model_download()
            elif path.startswith("/servers/") and path.endswith("/stop"):
                self._handle_stop_server(path)
            elif path.startswith("/servers/") and path.endswith("/restart"):
                self._handle_restart_server(path)
            elif path.startswith("/servers/") and path.endswith("/delete"):
                self._handle_delete_server(path)
            elif path == "/run":
                self._handle_run()
            elif path == "/launch/preview":
                self._handle_post_launch_preview()
            elif path == "/settings":
                self._handle_put_settings()
            elif path == "/validate":
                self._handle_validate()
            elif path == "/validate/config":
                self._handle_validate_config()
            elif path == "/run/config":
                self._handle_run_config()
            elif path == "/daemon/start":
                self._handle_post_daemon_start()
            elif path == "/daemon/stop":
                self._handle_post_daemon_stop()
            elif path == "/daemon/config":
                self._handle_put_daemon_config()
            else:
                self._send_json(404, {"error": f"Not found: {self.path}"})
        except Exception as e:
            logger.exception("POST %s failed", self.path)
            self._send_json(500, {"error": str(e)})

    def do_DELETE(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        try:
            if path.startswith("/servers/"):
                self._handle_delete_server(path)
            elif path.startswith("/models/") and path.count("/") == 2:
                self._handle_delete_model(path)
            else:
                self._send_json(404, {"error": f"Not found: {self.path}"})
        except Exception as e:
            logger.exception("DELETE %s failed", self.path)
            self._send_json(500, {"error": str(e)})

    def do_PUT(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        try:
            if path == "/settings":
                self._handle_put_settings()
            elif path.startswith("/models/"):
                self._handle_put_model(path)
            elif path == "/daemon/config":
                self._handle_put_daemon_config()
            else:
                self._send_json(404, {"error": f"Not found: {self.path}"})
        except Exception as e:
            logger.exception("PUT %s failed", self.path)
            self._send_json(500, {"error": str(e)})

    def _handle_get_models(self):
        _ensure_instantiated()
        models = _model_manager.autodetect_local_models()
        result = []
        for m in models:
            result.append({
                "id": m.get("id", ""),
                "path": m.get("path", ""),
                "size_bytes": m.get("size_bytes", 0),
                "size_human": _human_size(m.get("size_bytes", 0)),
                "last_modified": m.get("last_modified", ""),
                "tags": m.get("tags", []),
            })
        self._send_json(200, result)

    def _handle_get_model_resolve(self):
        """Resolve an alias to a full HuggingFace model identifier."""
        qs = self.path.split("?", 1)[1] if "?" in self.path else ""
        alias = ""
        for param in qs.split("&"):
            if param.startswith("alias="):
                alias = param.split("=", 1)[1]

        if not alias:
            self._send_json(400, {"error": "alias parameter is required"})
            return

        _ensure_instantiated()
        resolved = _model_manager.resolve_alias(alias)
        if resolved:
            self._send_json(200, {"alias": alias, "resolved": resolved})
        else:
            self._send_json(404, {"error": f"Alias not found: {alias}", "alias": alias})

    def _handle_get_model_quantizations(self):
        """Get available quantization variants for a HuggingFace model."""
        qs = self.path.split("?", 1)[1] if "?" in self.path else ""
        model_id = ""
        for param in qs.split("&"):
            if param.startswith("model="):
                model_id = param.split("=", 1)[1]

        if not model_id:
            self._send_json(400, {"error": "model parameter is required"})
            return

        _ensure_instantiated()

        # Resolve alias if needed
        if _model_manager.is_alias(model_id):
            resolved = _model_manager.resolve_alias(model_id)
            if resolved:
                model_id = resolved

        try:
            quantizations = asyncio.run(_model_manager.get_quantizations(model_id))
            self._send_json(200, {"model": model_id, "quantizations": quantizations})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_post_model_download(self):
        """Download a model from HuggingFace, optionally selecting a quantization."""
        body = self._read_body()
        model_id = body.get("model", body.get("model_id", ""))
        quantization = body.get("quantization", "")
        local_dir = body.get("local_dir", str(_config.local_model_search_paths[0]) if _config else "./hf_models")

        if not model_id:
            self._send_json(400, {"error": "model_id is required"})
            return

        _ensure_instantiated()

        # Resolve alias if needed
        if _model_manager.is_alias(model_id):
            resolved = _model_manager.resolve_alias(model_id)
            if resolved:
                model_id = resolved

        try:
            result = download_model(model_id, local_dir=local_dir, quantization=quantization or None)
            self._send_json(200, {
                "status": "downloaded",
                "model": model_id,
                "path": result,
                "quantization": quantization,
            })
        except Exception as e:
            logger.exception("Model download failed")
            self._send_json(500, {"error": str(e)})

    # ── Model CRUD ──────────────────────────────────────────────

    def _handle_post_model(self):
        """Add/register a new model."""
        body = self._read_body()
        path = body.get("path", body.get("model_path", ""))
        name = body.get("name", "")
        aliases = body.get("aliases", [])

        if not path:
            self._send_json(400, {"error": "path is required"})
            return

        _ensure_instantiated()
        model_path = Path(path)
        if not model_path.exists():
            self._send_json(400, {"error": f"Model path does not exist: {path}"})
            return

        model_id = name or model_path.stem
        _model_manager.registry.add_model(model_id, model_path, {"aliases": aliases})

        # Save aliases
        self._save_aliases()

        self._send_json(201, {
            "id": model_id,
            "path": str(model_path),
            "size_bytes": model_path.stat().st_size,
            "size_human": _human_size(model_path.stat().st_size),
            "last_modified": datetime.fromtimestamp(model_path.stat().st_mtime).isoformat(timespec="seconds"),
            "tags": ["gguf", "local"],
            "aliases": aliases,
        })

    def _handle_put_model(self, path):
        """Update an existing model."""
        # Extract model_id from path: /models/<id>
        parts = path.strip("/").split("/")
        if len(parts) != 2:
            self._send_json(400, {"error": "Invalid model path"})
            return
        model_id = parts[1]

        body = self._read_body()
        name = body.get("name")
        aliases = body.get("aliases")

        _ensure_instantiated()
        model_info = _model_manager.registry.get(model_id)
        if not model_info:
            self._send_json(404, {"error": f"Model not found: {model_id}"})
            return

        # If name changed, update registry
        if name and name != model_id:
            _model_manager.registry.delete_model(model_id)
            _model_manager.registry.add_model(name, model_info["path"], model_info.get("metadata"))
            model_id = name

        # Update metadata (aliases)
        metadata = model_info.get("metadata") or {}
        if aliases is not None:
            metadata["aliases"] = aliases
        _model_manager.registry.update_model(model_id, metadata)
        self._save_aliases()

        self._send_json(200, {
            "id": model_id,
            "path": str(model_info["path"]),
            "metadata": metadata,
        })

    def _handle_delete_model(self, path):
        """Delete a model from the registry."""
        parts = path.strip("/").split("/")
        if len(parts) != 2:
            self._send_json(400, {"error": "Invalid model path"})
            return
        model_id = parts[1]

        _ensure_instantiated()
        if not _model_manager.registry.delete_model(model_id):
            self._send_json(404, {"error": f"Model not found: {model_id}"})
            return

        self._send_json(200, {"deleted": model_id})

    def _handle_get_model_types(self):
        """Get models grouped by type."""
        _ensure_instantiated()
        groups = _model_manager.registry.get_model_types()
        result = []
        for type_name, models in groups.items():
            if not models:
                continue
            formatted = []
            for m in models:
                md = m.get("metadata") or {}
                formatted.append({
                    "id": m["id"],
                    "path": str(m["path"]),
                    "size_bytes": 0,
                    "size_human": "unknown",
                    "last_modified": "",
                    "tags": ["gguf", "local"],
                    "type": type_name,
                    "aliases": md.get("aliases", []),
                })
            result.append({"type": type_name, "models": formatted})
        self._send_json(200, result)

    def _handle_get_model_by_id(self, path):
        """Get a single model by ID."""
        parts = path.strip("/").split("/")
        if len(parts) != 2:
            self._send_json(400, {"error": "Invalid model path"})
            return
        model_id = parts[1]

        _ensure_instantiated()
        model_info = _model_manager.registry.get(model_id)
        if not model_info:
            self._send_json(404, {"error": f"Model not found: {model_id}"})
            return

        md = model_info.get("metadata") or {}
        self._send_json(200, {
            "id": model_id,
            "path": str(model_info["path"]),
            "size_bytes": model_info["path"].stat().st_size,
            "size_human": _human_size(model_info["path"].stat().st_size),
            "last_modified": datetime.fromtimestamp(model_info["path"].stat().st_mtime).isoformat(timespec="seconds"),
            "tags": ["gguf", "local"],
            "aliases": md.get("aliases", []),
        })

    def _save_aliases(self):
        """Save current aliases to model_aliases.json."""
        alias_path = Path(__file__).parent / "model_aliases.json"
        try:
            with open(alias_path, "w") as f:
                json.dump(_model_manager._aliases, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save aliases: {e}")

    def _handle_get_servers(self, path):
        _ensure_instantiated()
        servers = _process_manager.list_servers()
        result = []
        for port, record in servers.items():
            try:
                os.kill(record["pid"], 0)
                status = "running"
            except Exception:
                status = "stale"
            result.append({
                "port": port,
                "pid": record.get("pid"),
                "status": status,
                "model": record.get("model"),
                "started_at": record.get("started_at"),
            })
        self._send_json(200, result)

    def _handle_get_settings(self):
        _ensure_instantiated()
        self._send_json(200, {
            "server_port": _config.server_port,
            "n_ctx": _config.n_ctx,
            "n_gpu_layers": _config.n_gpu_layers,
            "temperature": _config.temperature,
            "top_k": _config.top_k,
            "top_p": _config.top_p,
            "n_predict": _config.n_predict,
            "threads": _config.threads,
            "log_level": _config.log_level,
            "modelCacheDir": str(_config.local_model_search_paths[0]) if _config.local_model_search_paths else "",
        })

    def _handle_get_logs(self):
        log_dir = Path.home() / ".llama_launcher" / "logs"
        limit = 200
        server_filter = None
        level_filter = None
        if "?" in self.path:
            qs = self.path.split("?", 1)[1]
            for param in qs.split("&"):
                if param.startswith("limit="):
                    try:
                        limit = int(param.split("=", 1)[1])
                    except ValueError:
                        pass
                elif param.startswith("server="):
                    server_filter = param.split("=", 1)[1]
                elif param.startswith("level="):
                    level_filter = param.split("=", 1)[1]

        entries = []

        # Read launcher (Python app) log
        launcher_log = log_dir / "launcher.log"
        if launcher_log.exists():
            lines = launcher_log.read_text().splitlines()[-limit * 2:]
            for line in lines:
                try:
                    entry = json.loads(line)
                    if server_filter and entry.get("serverId") != server_filter:
                        continue
                    if level_filter and entry.get("level") != level_filter:
                        continue
                    entries.append({
                        "timestamp": entry.get("timestamp", ""),
                        "level": entry.get("level", "INFO"),
                        "component": entry.get("component", ""),
                        "message": entry.get("message", line),
                        "serverId": entry.get("serverId"),
                    })
                except json.JSONDecodeError:
                    entries.append({
                        "timestamp": "",
                        "level": "INFO",
                        "component": "",
                        "message": line,
                        "serverId": None,
                    })

        # Read per-server log files
        server_log_files = list(log_dir.glob("server_*.log"))
        for log_file in server_log_files:
            if server_filter:
                # Extract port from filename: server_<port>.log
                try:
                    fname = log_file.stem  # e.g. "server_12345"
                    port_str = fname.split("_", 1)[1]
                    if server_filter != port_str:
                        continue
                except (IndexError, ValueError):
                    continue

            lines = log_file.read_text().splitlines()[-limit * 2:]
            port = log_file.stem.split("_", 1)[1] if "_" in log_file.stem else ""
            for line in lines:
                parsed = self._parse_server_log_line(line, port)
                if level_filter and parsed["level"] != level_filter:
                    continue
                entries.append(parsed)

        # Sort by timestamp and limit
        entries.sort(key=lambda e: e["timestamp"])
        total = len(entries)
        entries = entries[-limit:]

        self._send_json(200, {"entries": entries, "hasMore": total > limit})

    @staticmethod
    def _parse_server_log_line(line: str, server_id: str) -> Dict[str, str]:
        """Parse a llama-server log line into a LogEntry dict.

        llama.cpp log format examples:
        - [2024-01-15 10:30:45 +0000] [INFO] ggml_init: ...
        - llama_server_start: kv self-size = 8192.00 MB
        - [ERROR] failed to load model: ...
        """
        timestamp = ""
        level = "INFO"
        component = "llama-server"
        message = line

        # Try to extract timestamp: [YYYY-MM-DD HH:MM:SS ...]
        ts_match = re.search(r'\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]', line)
        if ts_match:
            timestamp = ts_match.group(1).replace(' ', 'T')

        # Try to extract level
        level_match = re.search(r'\[(DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL)\]', line, re.IGNORECASE)
        if level_match:
            level = level_match.group(1).upper()
            if level == "WARN":
                level = "WARNING"
            message = line[level_match.end():].strip()
        elif line.lower().startswith("error"):
            level = "ERROR"
            message = line[5:].strip().lstrip(": ").lstrip("- ")
        elif line.lower().startswith("warn"):
            level = "WARNING"
            message = line[4:].strip().lstrip(": ").lstrip("- ")

        return {
            "timestamp": timestamp,
            "level": level,
            "component": component,
            "message": message,
            "serverId": server_id,
        }

    def _handle_post_server(self):
        body = self._read_body()
        model_path = body.get("model", body.get("model_path", ""))
        port = int(body.get("port", 12345))
        
        # Read from args sub-object first (UI sends config inside args),
        # then fall back to top-level body keys, then hardcoded defaults.
        args = body.get("args", {})
        # Map UI field names to backend/CLI field names
        n_ctx = int(args.get("context_size") or body.get("n_ctx", 2048))
        n_gpu_layers = int(args.get("gpu_layers") if "gpu_layers" in args else body.get("n_gpu_layers", -1))
        threads = int(args.get("threads") if "threads" in args else body.get("threads", 8))
        temp = float(args.get("temperature") if "temperature" in args else body.get("temperature", 0.7))
        top_k = int(args.get("top_k") if "top_k" in args else body.get("top_k", 40))
        top_p = float(args.get("top_p") if "top_p" in args else body.get("top_p", 0.9))
        n_predict = int(args.get("n_predict") if "n_predict" in args else body.get("n_predict", 512))

        if not model_path:
            self._send_json(400, {"error": "model_path is required"})
            return

        _ensure_instantiated()
        # Determine log file path for this server
        log_dir = Path.home() / ".llama_launcher" / "logs"
        log_file = str(log_dir / f"server_{port}.log")

        try:
            result = _process_manager.start_server(
                model_path=model_path,
                port=port,
                n_ctx=n_ctx,
                n_gpu_layers=n_gpu_layers,
                threads=threads,
                temp=temp,
                top_k=top_k,
                top_p=top_p,
                n_predict=n_predict,
                log_file=log_file,
            )
            self._send_json(200, {
                "serverId": str(port),
                "message": result.get("status", "started"),
                "pid": result.get("pid"),
                "port": port,
            })
        except Exception as e:
            logger.exception("Failed to start server on port %d", port)
            self._send_json(500, {"error": str(e)})

    def _handle_post_launch_preview(self):
        body = self._read_body()
        model_path = body.get("model", body.get("model_path", ""))
        args = body.get("args", {})

        if not model_path:
            self._send_json(400, {"error": "model_path is required"})
            return

        try:
            from backend.llama_runner import LlamaRunner
            preview = LlamaRunner.get_command_preview(model_path, args)
            self._send_json(200, {"command": preview})
        except Exception as e:
            logger.exception("Failed to generate command preview")
            self._send_json(500, {"error": str(e)})

    def _handle_stop_server(self, path):
        parts = path.strip("/").split("/")
        try:
            port = int(parts[-2])
        except (IndexError, ValueError):
            self._send_json(400, {"error": "Invalid server path"})
            return
        _ensure_instantiated()
        result = _process_manager.stop_server(port)
        self._send_json(200, result)

    def _handle_restart_server(self, path):
        body = self._read_body()
        parts = path.strip("/").split("/")
        try:
            port = int(parts[-2])
        except (IndexError, ValueError):
            self._send_json(400, {"error": "Invalid server path"})
            return
        _ensure_instantiated()
        _process_manager.stop_server(port)
        model_path = body.get("model", body.get("model_path", ""))
        if not model_path:
            self._send_json(400, {"error": "model_path is required for restart"})
            return
        try:
            result = _process_manager.start_server(
                model_path=model_path,
                port=port,
                n_ctx=int(body.get("n_ctx", 2048)),
                n_gpu_layers=int(body.get("n_gpu_layers", -1)),
                threads=int(body.get("threads", 8)),
                temp=float(body.get("temperature", 0.7)),
                top_k=int(body.get("top_k", 40)),
                top_p=float(body.get("top_p", 0.9)),
                n_predict=int(body.get("n_predict", 512)),
            )
            self._send_json(200, {
                "serverId": str(port),
                "message": result.get("status", "restarted"),
                "pid": result.get("pid"),
                "port": port,
            })
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_delete_server(self, path):
        parts = path.strip("/").split("/")
        try:
            # For DELETE /servers/:id, the port is the last part
            port = int(parts[-1])
        except (IndexError, ValueError):
            self._send_json(400, {"error": "Invalid server path"})
            return
        _ensure_instantiated()
        _process_manager.stop_server(port)
        self._send_json(200, {"status": "deleted", "port": port})

    def _handle_run(self):
        body = self._read_body()
        model_path = body.get("model", body.get("model_path", ""))
        prompt = body.get("prompt", "")
        if not model_path:
            self._send_json(400, {"error": "model is required"})
            return
        if not prompt:
            self._send_json(400, {"error": "prompt is required"})
            return

        _ensure_instantiated()
        try:
            result = _runner.run_model_sync(model_path, prompt)
            self._send_json(200, {
                "status": "success",
                "output": result,
            })
        except Exception as e:
            logger.exception("run_model failed")
            self._send_json(500, {"error": str(e)})

    def _handle_put_settings(self):
        body = self._read_body()
        _ensure_instantiated()
        for key in ("server_port", "n_ctx", "n_gpu_layers", "temperature",
                     "top_k", "top_p", "n_predict", "threads", "log_level"):
            if key in body:
                setattr(_config, key, body[key])
        self._send_json(200, {"status": "updated"})

    def _handle_validate(self):
        body = self._read_body()
        errors: list[dict[str, str]] = []

        model = body.get("model", "")
        if not model:
            errors.append({"field": "model", "message": "Model path is required"})
        elif not model.endswith(".gguf"):
            errors.append({"field": "model", "message": "Model must be a .gguf file"})
        else:
            model_path = Path(model)
            if not model_path.exists():
                errors.append({"field": "model", "message": f"Model file not found: {model}"})

        try:
            port = int(body.get("port", 0))
            if port < 1024 or port > 65535:
                errors.append({"field": "port", "message": "Port must be between 1024 and 65535"})
        except (ValueError, TypeError):
            errors.append({"field": "port", "message": "Port must be a number"})

        try:
            int(body.get("args", {}).get("gpu_layers", 0))
        except (ValueError, TypeError):
            errors.append({"field": "gpu_layers", "message": "GPU layers must be a number"})

        try:
            int(body.get("args", {}).get("context_size", 0))
        except (ValueError, TypeError):
            errors.append({"field": "context_size", "message": "Context size must be a number"})

        try:
            int(body.get("args", {}).get("threads", 0))
        except (ValueError, TypeError):
            errors.append({"field": "threads", "message": "Threads must be a number"})

        try:
            int(body.get("args", {}).get("n_predict", 0))
        except (ValueError, TypeError):
            errors.append({"field": "n_predict", "message": "Max tokens must be a number"})

        try:
            float(body.get("args", {}).get("temperature", 0))
        except (ValueError, TypeError):
            errors.append({"field": "temperature", "message": "Temperature must be a number"})

        # ── New field validations ──
        args = body.get("args", {})

        # host: if present, validate as IP/hostname
        host = args.get("host", "127.0.0.1")
        if host:
            host_pattern = re.compile(
                r'^([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
                r'|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
                r'|^\[[0-9a-fA-F:]+\]$'
            )
            if not host_pattern.match(host):
                errors.append({"field": "host", "message": "Invalid host address"})

        # cors: must be boolean
        cors = args.get("cors", False)
        if not isinstance(cors, bool):
            try:
                args["cors"] = bool(int(cors))
            except (ValueError, TypeError):
                errors.append({"field": "cors", "message": "CORS must be true or false"})

        # cors_allow_origin: if present, must be valid origin
        cors_origin = args.get("cors_allow_origin", "")
        if cors_origin:
            if cors_origin != "*" and not re.match(
                r'^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+$', cors_origin
            ):
                errors.append({"field": "cors_allow_origin", "message": "Invalid CORS origin"})

        # api_key: if present, must be non-empty string
        api_key = args.get("api_key", "")
        if api_key and not isinstance(api_key, str):
            errors.append({"field": "api_key", "message": "API key must be a string"})

        # flash_attn: must be "on", "off", or "auto"
        flash_attn = args.get("flash_attn", "auto")
        if flash_attn not in ("on", "off", "auto"):
            errors.append({"field": "flash_attn", "message": "Flash attention must be on, off, or auto"})

        # Boolean flags
        for bool_field in ("no_mmap", "mlock", "cont_batching", "embedding", "logits_all", "speculative"):
            val = args.get(bool_field, False)
            if not isinstance(val, bool):
                try:
                    args[bool_field] = bool(int(val))
                except (ValueError, TypeError):
                    errors.append({"field": bool_field, "message": f"{bool_field} must be true or false"})

        # numa: must be empty or one of the valid values
        numa = args.get("numa", "")
        if numa and numa not in ("distribute", "isolate", "numactl"):
            errors.append({"field": "numa", "message": "NUMA must be distribute, isolate, or numactl"})

        # rope_scaling: must be "none", "linear", or "yarn"
        rope_scaling = args.get("rope_scaling", "none")
        if rope_scaling not in ("none", "linear", "yarn"):
            errors.append({"field": "rope_scaling", "message": "RoPE scaling must be none, linear, or yarn"})

        # rope_freq_base: must be positive number
        try:
            rope_freq_base = int(args.get("rope_freq_base", 0))
            if rope_freq_base < 0:
                errors.append({"field": "rope_freq_base", "message": "RoPE freq base must be non-negative"})
        except (ValueError, TypeError):
            errors.append({"field": "rope_freq_base", "message": "RoPE freq base must be a number"})

        # draft_model: if present, must be non-empty string
        draft_model = args.get("draft_model", "")
        if draft_model and not isinstance(draft_model, str):
            errors.append({"field": "draft_model", "message": "Draft model must be a string"})

        # prompt_cache: if present, must be non-empty string
        prompt_cache = args.get("prompt_cache", "")
        if prompt_cache and not isinstance(prompt_cache, str):
            errors.append({"field": "prompt_cache", "message": "Prompt cache must be a string"})

        # keep_live: must be non-negative number
        try:
            keep_live = int(args.get("keep_live", 0))
            if keep_live < 0:
                errors.append({"field": "keep_live", "message": "Keep live must be non-negative"})
        except (ValueError, TypeError):
            errors.append({"field": "keep_live", "message": "Keep live must be a number"})

        self._send_json(200, {"valid": len(errors) == 0, "errors": errors})


    def _handle_get_metrics(self):
        """Get system metrics (CPU, memory, disk, GPU).

        GPU data priority:
          1. llama.cpp running servers (via /metrics endpoint)
          2. Hardware detection via gpu_detector (pynvml / pyamdgpuinfo)
          3. Empty GPU data with gpuAvailable=false
        """
        _ensure_instantiated()
        try:
            import psutil
            now = _iso_now()
            vm = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            cpu_pct = psutil.cpu_percent(interval=0.1)
            load_avg = list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [0, 0, 0]

            gpu_available = False
            gpu_data: dict[str, Any] = {
                "utilization": 0,
                "memoryUsed": 0,
                "memoryTotal": 0,
                "temperature": 0,
            }

            # Priority 1: GPU metrics from llama.cpp running servers
            try:
                servers = _process_manager.list_servers() if _process_manager else {}
                total_gpu_mem_used = 0
                total_gpu_mem_total = 0
                max_utilization = 0
                max_temperature = 0
                for port, srv in servers.items():
                    if srv.get("status") == "running" and srv.get("port"):
                        try:
                            import httpx
                            resp = httpx.get(
                                f"http://127.0.0.1:{srv['port']}/metrics", timeout=2
                            )
                            if resp.status_code == 200:
                                srv_metrics = resp.json()
                                gpu_mem = srv_metrics.get("gpu_mem_used", 0)
                                gpu_mem_total = srv_metrics.get("gpu_mem_total", 0)
                                if gpu_mem_total > 0:
                                    gpu_available = True
                                    total_gpu_mem_used += gpu_mem
                                    total_gpu_mem_total += gpu_mem_total
                                srv_util = srv_metrics.get("gpu_utilization", 0)
                                if srv_util > max_utilization:
                                    max_utilization = srv_util
                                srv_temp = srv_metrics.get("gpu_temperature", 0)
                                if srv_temp > max_temperature:
                                    max_temperature = srv_temp
                        except Exception:
                            pass
                if total_gpu_mem_total > 0:
                    gpu_data["memoryTotal"] = total_gpu_mem_total
                    gpu_data["memoryUsed"] = total_gpu_mem_used
                    gpu_data["utilization"] = round(
                        (total_gpu_mem_used / total_gpu_mem_total) * 100, 1
                    )
                if max_utilization > 0:
                    gpu_data["utilization"] = max(
                        gpu_data["utilization"], max_utilization
                    )
                if max_temperature > 0:
                    gpu_data["temperature"] = max_temperature
            except Exception:
                pass

            # Priority 2: Fallback to hardware detection when no llama.cpp GPU data
            if not gpu_available:
                try:
                    gpus = gpu_detector.detect_gpu()
                    if gpus:
                        gpu_available = True
                        total_used = sum(g.get("memoryUsed", 0) for g in gpus)
                        total_total = sum(g.get("memoryTotal", 0) for g in gpus)
                        max_util = max((g.get("utilization", 0) for g in gpus), default=0)
                        max_temp = max((g.get("temperature", 0) for g in gpus), default=0)
                        if total_total > 0:
                            gpu_data["memoryTotal"] = total_total
                            gpu_data["memoryUsed"] = total_used
                            gpu_data["utilization"] = round(
                                (total_used / total_total) * 100, 1
                            )
                        gpu_data["utilization"] = max(gpu_data["utilization"], max_util)
                        gpu_data["temperature"] = max_temp
                except Exception:
                    pass

            metrics: dict[str, Any] = {
                "timestamp": now,
                "gpuAvailable": gpu_available,
                "system": {
                    "cpuPercent": cpu_pct,
                    "memoryPercent": psutil.virtual_memory().percent,
                    "memoryUsed": vm.used,
                    "memoryTotal": vm.total,
                    "diskPercent": disk.percent,
                    "diskUsed": disk.used,
                    "diskTotal": disk.total,
                    "loadAverage": load_avg[:3],
                },
                "gpu": gpu_data,
            }

            with _metrics_history_lock:
                _metrics_history.append(metrics)
                if len(_metrics_history) > _MAX_METRICS_HISTORY:
                    _metrics_history.pop(0)

            self._send_json(200, metrics)
        except ImportError:
            now = _iso_now()
            fallback = {
                "timestamp": now,
                "gpuAvailable": False,
                "system": {
                    "cpuPercent": 0,
                    "memoryPercent": 0,
                    "memoryUsed": 0,
                    "memoryTotal": 1,
                    "diskPercent": 0,
                    "diskUsed": 0,
                    "diskTotal": 1,
                    "loadAverage": [0, 0, 0],
                },
                "gpu": {
                    "utilization": 0,
                    "memoryUsed": 0,
                    "memoryTotal": 0,
                    "temperature": 0,
                },
            }
            with _metrics_history_lock:
                _metrics_history.append(fallback)
                if len(_metrics_history) > _MAX_METRICS_HISTORY:
                    _metrics_history.pop(0)
            self._send_json(200, fallback)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_get_metrics_gpu(self):
        """Return GPU metrics from hardware detection (no llama.cpp server needed)."""
        try:
            gpus = gpu_detector.detect_gpu()
            if not gpus:
                self._send_json(200, {
                    "gpuAvailable": False,
                    "gpus": [],
                    "backend": "",
                })
                return

            # Aggregate metrics across GPUs
            total_used = 0
            total_total = 0
            max_util = 0
            max_temp = 0
            for g in gpus:
                total_used += g.get("memoryUsed", 0)
                total_total += g.get("memoryTotal", 0)
                max_util = max(max_util, g.get("utilization", 0))
                max_temp = max(max_temp, g.get("temperature", 0))

            self._send_json(200, {
                "gpuAvailable": True,
                "backend": gpu_detector.get_active_backend(),
                "gpus": gpus,
                "aggregate": {
                    "memoryUsed": total_used,
                    "memoryTotal": total_total,
                    "utilization": round(max_util, 1),
                    "temperature": max_temp,
                },
            })
        except Exception as e:
            logger.exception("GPU metrics failed")
            self._send_json(200, {
                "gpuAvailable": False,
                "gpus": [],
                "backend": "",
            })

    def _handle_get_health(self):
        """Return system health status including GPU availability."""
        _ensure_instantiated()
        gpu_available = False
        gpu_backends = []

        # Check if any llama.cpp servers are running (indicates GPU usage)
        try:
            servers = _process_manager.list_servers()
            for port, srv in servers.items():
                if srv.get("status") == "running" and srv.get("port"):
                    try:
                        import httpx
                        resp = httpx.get(
                            f"http://127.0.0.1:{srv['port']}/metrics", timeout=2
                        )
                        if resp.status_code == 200:
                            gpu_mem = resp.json().get("gpu_mem_total", 0)
                            if gpu_mem > 0:
                                gpu_available = True
                    except Exception:
                        pass
        except Exception:
            pass

        # Try importing NVIDIA/AMD GPU libraries to detect hardware
        try:
            import nvidia_smi  # noqa: F401
            gpu_backends.append("nvidia_smi")
            gpu_available = True
            try:
                nvidia_smi.nvmlInit()
                dev_count = nvidia_smi.NvmlDeviceGetCount()
                nvidia_smi.nvmlShutdown()
                gpu_backends.append(f"{dev_count} device(s)")
            except Exception:
                pass
        except ImportError:
            pass

        try:
            import amdgpuinfo  # noqa: F401
            gpu_backends.append("amdgpuinfo")
            gpu_available = True
        except ImportError:
            pass

        self._send_json(200, {
            "status": "ok",
            "gpuAvailable": gpu_available,
            "gpuBackends": gpu_backends,
            "psutilAvailable": True,
            "timestamp": _iso_now(),
        })

    def _handle_get_metrics_history(self):
        """Get metrics history."""
        limit = 100
        if "?" in self.path:
            qs = self.path.split("?", 1)[1]
            for param in qs.split("&"):
                if param.startswith("limit="):
                    try:
                        limit = int(param.split("=", 1)[1])
                    except ValueError:
                        pass
        with _metrics_history_lock:
            history = list(_metrics_history[-limit:])
        self._send_json(200, history)

    def _handle_get_daemon_status(self):
        """Get real daemon status."""
        self._send_json(200, daemon_module.daemon_status())

    def _handle_get_daemon_logs(self):
        """Get daemon logs."""
        log_dir = Path.home() / ".llama_launcher" / "logs"
        limit = 200
        if "?" in self.path:
            qs = self.path.split("?", 1)[1]
            for param in qs.split("&"):
                if param.startswith("limit="):
                    try:
                        limit = int(param.split("=", 1)[1])
                    except ValueError:
                        pass
        entries = []
        log_file = log_dir / "launcher.log"
        if log_file.exists():
            lines = log_file.read_text().splitlines()[-limit:]
            for line in lines:
                try:
                    entry = json.loads(line)
                    entries.append({
                        "timestamp": entry.get("timestamp", ""),
                        "level": entry.get("level", "INFO"),
                        "component": entry.get("component", ""),
                        "message": entry.get("message", line),
                    })
                except json.JSONDecodeError:
                    entries.append({
                        "timestamp": "",
                        "level": "INFO",
                        "component": "",
                        "message": line,
                    })
        total_lines = len(lines) if 'lines' in dir() else 0
        self._send_json(200, {"entries": entries, "hasMore": total_lines > limit})

    def _handle_get_daemon_service(self):
        """Return the current service file path."""
        svc_path = daemon_module.get_service_path()
        if svc_path is None:
            self._send_json(200, {
                "servicePath": None,
                "message": "No service file generated. Start the daemon first.",
            })
            return
        svc_path_obj = Path(svc_path)
        self._send_json(200, {
            "servicePath": svc_path,
            "exists": svc_path_obj.exists(),
            "content": svc_path_obj.read_text() if svc_path_obj.exists() else "",
        })

    def _handle_post_daemon_start(self):
        """Start the daemon: generate service file and record state."""
        body = self._read_body()
        if not _config:
            _ensure_instantiated()
        result = daemon_module.start_daemon_impl(
            service_name=body.get("profile", "default"),
            model_path=_config.default_model_path if _config else None,
            port=_config.server_port if _config else 12345,
            user=os.environ.get("USER", "root"),
            config=body.get("config"),
        )
        self._send_json(200, result)

    def _handle_post_daemon_stop(self):
        """Stop the daemon."""
        result = daemon_module.stop_daemon_impl()
        self._send_json(200, result)

    def _handle_put_daemon_config(self):
        """Update daemon config."""
        body = self._read_body()
        daemon_module._daemon_config.update(body)
        self._send_json(200, {
            "status": "updated",
            "config": dict(daemon_module._daemon_config),
        })

def _iso_now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _human_size(nbytes):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(nbytes) < 1024.0:
            return f"{nbytes:.1f} {unit}"
        nbytes /= 1024.0
    return f"{nbytes:.1f} PB"


_api_server = None


def api_server(host="127.0.0.1", port=8501):
    global _api_server
    _api_server = HTTPServer((host, port), APIHandler)
    _init_gpu_detection()
    return _api_server


def get_api_server():
    return _api_server


def stop_api_server():
    global _api_server
    if _api_server:
        _api_server.shutdown()
        _api_server = None


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="llama-launcher API server")
    parser.add_argument("-p", "--port", type=int, default=8501)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    server = api_server(args.host, args.port)
    print(f"API server running on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
