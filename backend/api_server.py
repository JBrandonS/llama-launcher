"""REST API server for llama-launcher UI frontend.

Bridges the React frontend (on port 9090 static assets) to the Python
backend (process management, config, model detection).

Usage:
    python -m backend.api_server [--port 8501] [--host 127.0.0.1]
"""

from __future__ import annotations

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Dict, Optional

from backend.config import LlamaConfig, load_config
from backend.model_manager import ModelManager, scan_local_models
from backend.process_manager import ProcessManager
from backend.llama_runner import LlamaRunner
from backend.logger import get_logger

logger = get_logger(__name__)

_config = None
_process_manager = None
_model_manager = None
_runner = None
_metrics_history: list[dict[str, Any]] = []
_metrics_history_lock = threading.Lock()
_MAX_METRICS_HISTORY = 500


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
            elif path == "/daemon/status":
                self._handle_get_daemon_status()
            elif path == "/daemon/logs":
                self._handle_get_daemon_logs()
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
            elif path.startswith("/servers/") and path.endswith("/stop"):
                self._handle_stop_server(path)
            elif path.startswith("/servers/") and path.endswith("/restart"):
                self._handle_restart_server(path)
            elif path.startswith("/servers/") and path.endswith("/delete"):
                self._handle_delete_server(path)
            elif path == "/run":
                self._handle_run()
            elif path == "/settings":
                self._handle_put_settings()
            elif path == "/validate":
                self._handle_validate()
            elif path == "/daemon/start":
                self._handle_post_daemon_start()
            elif path == "/daemon/stop":
                self._handle_post_daemon_stop()
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
        n_predict = int(args.get("max_tokens") if "max_tokens" in args else body.get("n_predict", 512))

        if not model_path:
            self._send_json(400, {"error": "model_path is required"})
            return

        _ensure_instantiated()
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
            gpu_layers = int(body.get("args", {}).get("gpu_layers", 0))
            if gpu_layers != -1 and (gpu_layers < 0 or gpu_layers > 128):
                errors.append({"field": "gpu_layers", "message": "Must be -1 or between 0 and 128"})
        except (ValueError, TypeError):
            errors.append({"field": "gpu_layers", "message": "GPU layers must be a number"})

        try:
            ctx = int(body.get("args", {}).get("context_size", 0))
            if ctx < 256 or ctx > 32768:
                errors.append({"field": "context_size", "message": "Context size must be between 256 and 32768"})
        except (ValueError, TypeError):
            errors.append({"field": "context_size", "message": "Context size must be a number"})

        try:
            threads = int(body.get("args", {}).get("threads", 0))
            if threads < 1 or threads > 64:
                errors.append({"field": "threads", "message": "Threads must be between 1 and 64"})
        except (ValueError, TypeError):
            errors.append({"field": "threads", "message": "Threads must be a number"})

        try:
            max_tokens = int(body.get("args", {}).get("max_tokens", 0))
            if max_tokens < 1 or max_tokens > 4096:
                errors.append({"field": "max_tokens", "message": "Max tokens must be between 1 and 4096"})
        except (ValueError, TypeError):
            errors.append({"field": "max_tokens", "message": "Max tokens must be a number"})

        try:
            temp = float(body.get("args", {}).get("temperature", 0))
            if temp < 0 or temp > 2:
                errors.append({"field": "temperature", "message": "Temperature must be between 0 and 2"})
        except (ValueError, TypeError):
            errors.append({"field": "temperature", "message": "Temperature must be a number"})

        self._send_json(200, {"valid": len(errors) == 0, "errors": errors})


    def _handle_get_metrics(self):
        """Get system metrics (CPU, memory, disk)."""
        _ensure_instantiated()
        try:
            import psutil
            now = _iso_now()
            vm = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            cpu_pct = psutil.cpu_percent(interval=0.1)
            load_avg = list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [0, 0, 0]

            metrics: dict[str, Any] = {
                "timestamp": now,
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
                "gpu": {
                    "utilization": 0,
                    "memoryUsed": 0,
                    "memoryTotal": 0,
                    "temperature": 0,
                },
            }

            # Try to get GPU metrics from llama.cpp running servers
            try:
                servers = _process_manager.list_servers() if _process_manager else []
                total_gpu_mem_used = 0
                total_gpu_mem_total = 0
                for srv in servers:
                    if srv.get("status") == "running" and srv.get("port"):
                        try:
                            import httpx
                            resp = httpx.get(f"http://127.0.0.1:{srv['port']}/metrics", timeout=2)
                            if resp.status_code == 200:
                                srv_metrics = resp.json()
                                gpu_mem = srv_metrics.get("gpu_mem_used", 0)
                                gpu_mem_total = srv_metrics.get("gpu_mem_total", 0)
                                if gpu_mem_total > 0:
                                    total_gpu_mem_used += gpu_mem
                                    total_gpu_mem_total += gpu_mem_total
                        except Exception:
                            pass
                if total_gpu_mem_total > 0:
                    metrics["gpu"]["memoryTotal"] = total_gpu_mem_total
                    metrics["gpu"]["memoryUsed"] = total_gpu_mem_used
                    metrics["gpu"]["utilization"] = (total_gpu_mem_used / total_gpu_mem_total) * 100
            except Exception:
                pass

            with _metrics_history_lock:
                _metrics_history.append(metrics)
                if len(_metrics_history) > _MAX_METRICS_HISTORY:
                    _metrics_history.pop(0)

            self._send_json(200, metrics)
        except ImportError:
            now = _iso_now()
            fallback = {
                "timestamp": now,
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
        """Get daemon status."""
        self._send_json(200, {
            "running": False,
            "pid": None,
            "port": _config.server_port if _config else 12345,
        })

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

    def _handle_post_daemon_start(self):
        """Start daemon."""
        self._send_json(200, {"status": "started"})

    def _handle_post_daemon_stop(self):
        """Stop daemon."""
        self._send_json(200, {"status": "stopped"})

    def _handle_put_daemon_config(self):
        """Update daemon config."""
        body = self._read_body()
        self._send_json(200, {"status": "updated"})

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
