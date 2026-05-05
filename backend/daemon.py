# backend/daemon.py
import os
import threading
import time
from pathlib import Path
from typing import Optional, Callable, List, Dict, Any

from backend.constants import SERVICE_DIR

class Daemon:
    """Lightweight daemon scaffold that runs a target in a background thread."""

    def __init__(self, target: Optional[Callable] = None):
        self._target = target
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._reload_event = threading.Event()

    def start(self) -> None:
        """Start the daemon in a background thread."""
        if self._thread and self._thread.is_alive():
            return
        
        self._stop_event.clear()
        self._reload_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop the daemon cleanly."""
        if not self._thread or not self._thread.is_alive():
            return
        
        self._stop_event.set()
        self._thread.join(timeout=5.0)

    def reload(self) -> None:
        """Signal a reload to the daemon."""
        self._reload_event.set()

    def _run(self) -> None:
        """Internal run loop that invokes the target."""
        if self._target:
            try:
                self._target(self._stop_event, self._reload_event, {})
            except Exception:
                pass
        else:
            # Default no-op loop
            while not self._stop_event.is_set():
                time.sleep(0.1)

_global_daemon: Optional[Daemon] = None

def start_daemon(target: Optional[Callable] = None) -> Daemon:
    """Start the global daemon with an optional target."""
    global _global_daemon
    _global_daemon = Daemon(target)
    _global_daemon.start()
    return _global_daemon

def stop_daemon() -> None:
    """Stop the global daemon."""
    global _global_daemon
    if _global_daemon:
        _global_daemon.stop()

def reload_daemon() -> None:
    """Signal reload to the global daemon."""
    global _global_daemon
    if _global_daemon:
        _global_daemon.reload()

# Global state for daemon management
_daemon_config = {
    "autoLaunchOnStart": True,
    "pollIntervalSeconds": 10,
    "maxLaunchAttempts": 5,
    "retryDelaySeconds": 5,
    "healthCheckInterval": 5,
}
_current_service_path: Optional[str] = None
_start_time: Optional[float] = None


def get_service_file_path(service_name: str) -> Path:
    """Return the path where the systemd service file will be written."""
    SERVICE_DIR.mkdir(parents=True, exist_ok=True)
    return SERVICE_DIR / f'{service_name}.service'


def generate_systemd_service(
    service_name: str,
    description: str,
    exec_start: str,
    after: str = "network.target",
    user: str = "root",
    log_file: Optional[str] = None,
) -> str:
    # Build standard output/error directives if a log file is provided
    stdout_lines = ""
    if log_file:
        # Ensure the log directory exists via ExecStartPre
        log_dir = str(Path(log_file).parent)
        stdout_lines = (
            f"\nExecStartPre=/bin/mkdir -p {log_dir}\n"
            f"StandardOutput=append:{log_file}\n"
            f"StandardError=append:{log_file}"
        )

    return f"""[Unit]
Description={description}
After={after}

[Service]
Type=simple
User={user}
ExecStart={exec_start}{stdout_lines}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
"""


def generate_service_file(
    service_name: str,
    description: str,
    exec_start: str,
    user: str = "root",
) -> str:
    """Generate and persist the systemd service file.

    Returns the file path where the service file was written.
    """
    global _current_service_path
    path = get_service_file_path(service_name)
    content = generate_systemd_service(
        service_name=service_name,
        description=description,
        exec_start=exec_start,
        user=user,
    )
    path.write_text(content)
    _current_service_path = str(path)
    return str(path)


def generate_server_service(
    port: int,
    model_path: str,
    host: str = "127.0.0.1",
    n_ctx: int = 4096,
    n_gpu_layers: int = -1,
    threads: int = 4,
    temp: float = 0.7,
    top_k: int = 40,
    top_p: float = 0.95,
    n_predict: int = 256,
    user: str = "root",
    log_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a systemd service file for a llama-server instance.

    The service writes logs to ~/.cache/llama-launcher/logs/server_<port>.log
    by default, which is compatible with the log viewer.

    Returns a dict with 'service_path' and 'log_file' keys.
    """
    global _current_service_path

    # Determine log file path
    if log_dir is None:
        from backend.constants import LOG_DIR
        log_dir = str(LOG_DIR)

    log_file = f"{log_dir}/server_{port}.log"

    # Build the llama-server command
    cmd_parts = ["llama-server"]
    cmd_parts.extend(["--model", model_path])
    cmd_parts.extend(["--host", host])
    cmd_parts.extend(["--port", str(port)])
    cmd_parts.extend(["--threads", str(threads)])
    cmd_parts.extend(["--ctx-size", str(n_ctx)])
    if n_gpu_layers != -1:
        cmd_parts.extend(["--n-gpu-layers", str(n_gpu_layers)])
    cmd_parts.extend(["--temp", str(temp)])
    cmd_parts.extend(["--top-k", str(top_k)])
    cmd_parts.extend(["--top-p", str(top_p)])
    cmd_parts.extend(["--n-predict", str(n_predict)])

    exec_start = " ".join(cmd_parts)
    service_name = f"llama-server-{port}"
    description = f"Llama server on port {port} ({model_path})"

    content = generate_systemd_service(
        service_name=service_name,
        description=description,
        exec_start=exec_start,
        user=user,
        log_file=log_file,
    )

    # Write the service file to the standard service directory
    path = get_service_file_path(service_name)
    path.write_text(content)
    _current_service_path = str(path)

    return {
        "service_path": str(path),
        "log_file": log_file,
        "port": port,
        "command": exec_start,
    }


def get_service_path() -> Optional[str]:
    """Return the path of the most recently generated service file."""
    return _current_service_path


def reset_state() -> None:
    """Reset daemon state (for testing / fresh start)."""
    global _start_time, _current_service_path
    _start_time = None
    _current_service_path = None


def daemon_status() -> Dict[str, Any]:
    """Return current daemon status for API consumption."""
    global _start_time
    uptime = 0
    if _start_time is not None:
        uptime = int(time.time() - _start_time)
    return {
        "status": "running" if _start_time is not None else "stopped",
        "running": _start_time is not None,
        "pid": os.getpid() if _start_time is not None else None,
        "uptimeSeconds": uptime,
        "servicePath": get_service_path(),
        "monitoredServers": [],
        "errors": [],
        "config": dict(_daemon_config),
    }


def start_daemon_impl(
    service_name: str = "default",
    exec_start: str = "llama-launcher run",
    user: str = "root",
    model_path: Optional[str] = None,
    port: int = 12345,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Start the daemon: generate service file and record running state.

    Returns a status dict matching the frontend's DaemonPage expectations.
    """
    global _start_time, _daemon_config
    if _start_time is not None:
        return {"status": "already_running", "running": True}

    # Merge config
    if config:
        _daemon_config.update(config)

    # Build exec command
    if model_path:
        cmd = f"llama-launcher run --model '{model_path}' --port {port}"
    else:
        cmd = exec_start

    service_path = generate_service_file(
        service_name=f"llama-daemon-{service_name}",
        description=f"Llama launcher daemon for profile '{service_name}'",
        exec_start=cmd,
        user=user,
    )

    _start_time = time.time()

    return {
        "status": "running",
        "running": True,
        "pid": os.getpid(),
        "uptimeSeconds": 0,
        "servicePath": service_path,
        "monitoredServers": [],
        "errors": [],
        "config": dict(_daemon_config),
    }


def stop_daemon_impl() -> Dict[str, Any]:
    """Stop the daemon.

    Returns a status dict matching the frontend's DaemonPage expectations.
    """
    global _start_time
    if _start_time is None:
        return {"status": "stopped", "running": False}
    _start_time = None
    return daemon_status()