"""Desktop UI launcher for llama-launcher.

Serves the built Vite static assets from ui/dist/ inside a native
webview window.  Uses pywebview for the window container and stdlib
http.server for both static file serving and the backend API.

Usage:
    python ui/launcher.py              # direct execution
    python -m ui.launcher              # module invocation
"""

from __future__ import annotations

# ── GPU disable for QtWebEngine (MUST precede all other imports) ──
# Prevents vkCreateDevice/GBM crashes when Vulkan or hardware
# acceleration is unavailable (headless, CI, or missing drivers).
import os as _os
_os.environ.setdefault("QTWEBENGINE_DISABLE_GPU", "1")
_os.environ.setdefault("QTWEBENGINE_GPU_PROCESS", "disabled")
_os.environ.setdefault("QTWEBENGINE_SANDBOX", "0")
_os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS",
                       "--disable-gpu --disable-gpu-compositing "
                       "--disable-gpu-driver-bug-workarounds "
                       "--disable-gpu-sandbox")

import argparse
import http.server
import socketserver
import sys
import threading
import webview
from pathlib import Path

DEFAULT_PORT = 9090
API_PORT = 8501

# Resolve project root relative to this file's location.
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent if _SCRIPT_DIR.name == "ui" else _SCRIPT_DIR

ASSETS_DIR = _PROJECT_ROOT / "ui" / "dist"

DEFAULT_MIME = "text/plain"


class StaticHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.directory = ASSETS_DIR
        super().__init__(*args, directory=self.directory, **kwargs)

    def log_message(self, format: str, *args) -> None:
        print(f"[launcher] {format % args}", flush=True)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self) -> None:
        path = self.path.rstrip("/")
        if not path or path == "/":
            path = "/"
        self.path = path
        super().do_GET()

    def translate_path(self, path: str) -> str:
        return super().translate_path(path)

    def send_error_page(self, code: int, message: str, explain: str) -> None:
        if code == 404:
            self.path = "/index.html"
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            with open(ASSETS_DIR / "index.html", "rb") as f:
                self.wfile.write(f.read())
        else:
            super().send_error_page(code, message, explain)

    def handle_one_request(self) -> None:
        try:
            super().handle_one_request()
        except ConnectionResetError:
            pass


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def build_url(host: str, port: int) -> str:
    base = host if host != "127.0.0.1" else "localhost"
    return f"http://{base}:{port}"


def start_api_server(host: str, port: int):
    """Start the backend API server in a background thread."""
    import sys as _sys
    if str(_PROJECT_ROOT) not in _sys.path:
        _sys.path.insert(0, str(_PROJECT_ROOT))

    try:
        from backend.api_server import api_server as _api_server_fn
        srv = _api_server_fn(host, port)
        srv.serve_forever()
    except Exception as e:
        print(f"[launcher] Warning: Could not start API server: {e}", file=sys.stderr)
        print("[launcher] UI will start without backend API.", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Standalone UI launcher for llama-launcher",
    )
    parser.add_argument(
        "-p", "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to serve UI on (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--api-port",
        type=int,
        default=API_PORT,
        help=f"Port for API server (default: {API_PORT})",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=0,
        help="Auto-close window after N seconds (default: 0 = never)",
    )
    args = parser.parse_args()

    if not ASSETS_DIR.is_dir():
        print(
            f"Error: assets directory not found at {ASSETS_DIR}",
            file=sys.stderr,
        )
        print(
            "Run 'cd ui && npm run build' first.",
            file=sys.stderr,
        )
        sys.exit(1)

    index_path = ASSETS_DIR / "index.html"
    if not index_path.is_file():
        print(
            f"Error: index.html not found at {index_path}",
            file=sys.stderr,
        )
        sys.exit(1)

    ui_url = build_url(args.host, args.port)
    api_url = build_url(args.host, args.api_port)

    api_server_thread = threading.Thread(
        target=start_api_server,
        args=(args.host, args.api_port),
        daemon=True,
    )
    api_server_thread.start()

    handler = StaticHandler
    server = ThreadedServer((args.host, args.port), handler)

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    print(f"\n{'='*50}")
    print(f"  llama-launcher UI")
    print(f"  Serving: {ASSETS_DIR}")
    print(f"  Open:    {ui_url}")
    print(f"  API:     {api_url}")
    # Debug: verify GPU disable env vars
    print(f"  QTWEBENGINE_DISABLE_GPU={_os.environ.get('QTWEBENGINE_DISABLE_GPU')}")
    print(f"  QTWEBENGINE_CHROMIUM_FLAGS={_os.environ.get('QTWEBENGINE_CHROMIUM_FLAGS')}")
    print(f"{'='*50}\n")

    shutdown_event = threading.Event()

    def _on_shutdown():
        print("\n[launcher] Shutting down servers...", flush=True)
        try:
            from backend.api_server import stop_api_server as _stop_api
            _stop_api()
        except Exception:
            pass
        try:
            server.shutdown()
        except Exception:
            pass

    def _shutdown_handler():
        if not shutdown_event.is_set():
            shutdown_event.set()
            threading.Thread(target=_on_shutdown, daemon=True).start()

    import signal
    signal.signal(signal.SIGINT, lambda *_: _shutdown_handler())
    signal.signal(signal.SIGTERM, lambda *_: _shutdown_handler())

    webview.create_window(
        "llama-launcher",
        ui_url,
        server=server,
        width=1100,
        height=780,
        js_api=None,
        text_select=True,
        resizable=True,
        focus=True,
    )

    if args.timeout > 0:
        import threading as _threading

        def _auto_close() -> None:
            print(
                f"[launcher] Timeout reached ({args.timeout}s). Closing window...",
                flush=True,
            )
            _threading.Timer(0.5, lambda: webview.windows[0].destroy()).start()

        _threading.Timer(args.timeout, _auto_close).start()
        print(f"[launcher] Auto-close in {args.timeout}s", flush=True)

    try:
        webview.start()
    except KeyboardInterrupt:
        _shutdown_handler()


if __name__ == "__main__":
    main()
