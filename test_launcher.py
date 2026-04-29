import sys, threading, http.server, socketserver, time, os
from pathlib import Path

os.environ["QT_QPA_PLATFORM"] = "offscreen"

sys.path.insert(0, str(Path('.').resolve()))

_SCRIPT_DIR = Path('ui').resolve()
_PROJECT_ROOT = _SCRIPT_DIR.parent if _SCRIPT_DIR.name == 'ui' else _SCRIPT_DIR
ASSETS_DIR = _PROJECT_ROOT / 'ui' / 'dist'

class StaticHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.directory = ASSETS_DIR
        super().__init__(*args, directory=self.directory, **kwargs)
    def log_message(self, format, *args):
        print(f'[launcher] {format % args}', flush=True)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def do_GET(self):
        path = self.path.rstrip('/')
        if not path or path == '/':
            path = '/'
        self.path = path
        super().do_GET()

class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

server = ThreadedServer(('127.0.0.1', 9090), StaticHandler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()
print('HTTP server running on http://127.0.0.1:9090', flush=True)

import sys as _sys
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QApplication
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtCore import QUrl, QTimer

QApplication.setAttribute(Qt.ApplicationAttribute.AA_ShareOpenGLContexts)
app = QApplication(_sys.argv)

view = QWebEngineView()
view.resize(1100, 780)
view.page().urlChanged.connect(lambda url: print(f'  URL: {url.toString()}', flush=True))
view.page().loadFinished.connect(lambda ok: print(f'  Load: {ok}', flush=True))
view.page().setUrl(QUrl('http://127.0.0.1:9090/'))

def diagnose():
    time.sleep(3)
    view.page().runJavaScript(
        'document.getElementById("root") ? document.getElementById("root").innerHTML.substring(0, 1000) : "NO ROOT"',
        lambda r: print(f'DOM: {r}', flush=True)
    )
    view.page().runJavaScript(
        'document.querySelectorAll("script").length + " scripts; " + document.querySelectorAll("link").length + " links"',
        lambda r: print(f'Resources: {r}', flush=True)
    )
    view.page().toImage(lambda img: img.save('/home/b/git/llama-launcher/ui/dist/screenshot.png', b'PNG'))
    print('Screenshot saved', flush=True)
    QTimer.singleShot(500, app.quit)

QTimer.singleShot(10000, diagnose)

ret = app.exec()
print(f'Exit: {ret}', flush=True)
server.shutdown()
sys.exit(ret)
