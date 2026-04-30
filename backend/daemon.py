# backend/daemon.py
import os
import threading
import time
from pathlib import Path
from typing import Optional, Callable, List

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