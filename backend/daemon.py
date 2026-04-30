# backend/daemon.py
import os
import threading
import time
from pathlib import Path
from typing import Optional, Callable, List, Dict, Any

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

SERVICE_DIR = Path.home() / '.llama_launcher' / 'services'

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
    user: str = "root"
) -> str:
    return f"""[Unit]
Description={description}
After={after}

[Service]
Type=simple
User={user}
ExecStart={exec_start}
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