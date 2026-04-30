# backend/process_manager.py
import os
import signal
import subprocess
import time
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

try:
    import psutil
except ImportError:
    psutil = None


PID_DIR = Path.home() / '.llama_launcher' / 'pids'


class ProcessManager:
    def __init__(self, config=None):
        self.config = config or {}
        PID_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _find_server_executable() -> str:
        import shutil
        for name in ("llama-server", "llama.cpp/main", "main"):
            if shutil.which(name):
                return name
        return "llama-server"

    def start_server(
        self,
        model_path: str,
        host: str = '127.0.0.1',
        port: int = 12345,
        n_ctx: int = 4096,
        n_gpu_layers: int = -1,
        threads: int = 4,
        temp: float = 0.7,
        top_k: int = 40,
        top_p: float = 0.95,
        n_predict: int = 256,
        log_file: Optional[str] = None,
    ) -> Dict[str, Any]:
        exe = self._find_server_executable()
        cmd = [exe]
        cmd.extend(['--model', str(model_path)])
        cmd.extend(['--host', host])
        cmd.extend(['--port', str(port)])
        cmd.extend(['--threads', str(threads)])
        cmd.extend(['--ctx-size', str(n_ctx)])
        if n_gpu_layers != -1:
            cmd.extend(['--n-gpu-layers', str(n_gpu_layers)])
        cmd.extend(['--temp', str(temp)])
        cmd.extend(['--top-k', str(top_k)])
        cmd.extend(['--top-p', str(top_p)])
        cmd.extend(['--n-predict', str(n_predict)])

        log = None
        if log_file:
            Path(log_file).parent.mkdir(parents=True, exist_ok=True)
            log = open(log_file, 'a')

        proc = subprocess.Popen(cmd, stdout=log, stderr=log, text=True)

        record = {
            'pid': proc.pid,
            'model': str(model_path),
            'host': host,
            'port': port,
            'n_ctx': n_ctx,
            'n_gpu_layers': n_gpu_layers,
            'threads': threads,
            'temp': temp,
            'top_k': top_k,
            'top_p': top_p,
            'n_predict': n_predict,
            'started_at': time.time(),
            'log_file': log_file,
        }

        pid_file = self._pid_file(port)
        with open(pid_file, 'w') as f:
            json.dump(record, f, indent=2)

        if log:
            log.close()

        return {'status': 'started', 'pid': proc.pid, 'port': port, 'command': ' '.join(cmd)}

    def stop_server(self, port: int) -> Dict[str, Any]:
        pid_file = self._pid_file(port)
        if not pid_file.exists():
            return {'status': 'not_running', 'port': port}

        try:
            with open(pid_file) as f:
                record = json.load(f)
        except (json.JSONDecodeError, KeyError):
            return {'status': 'invalid_pid_file', 'port': port}

        pid = record['pid']
        graceful = False
        try:
            os.kill(pid, signal.SIGTERM)
            for _ in range(20):
                time.sleep(0.25)
                try:
                    os.kill(pid, 0)
                except OSError:
                    graceful = True
                    break
            if not graceful:
                os.kill(pid, signal.SIGKILL)
                time.sleep(0.2)
        except ProcessLookupError:
            graceful = True

        pid_file.unlink(missing_ok=True)
        log_file = record.get('log_file')
        if log_file and Path(log_file).exists():
            try:
                Path(log_file).unlink()
            except OSError:
                pass

        return {'status': 'stopped' if graceful else 'killed', 'port': port, 'pid': pid}

    def status(self, port: Optional[int] = None) -> Dict[str, Any]:
        if port is not None:
            pid_file = self._pid_file(port)
            if not pid_file.exists():
                return {'status': 'not_running', 'port': port}
            with open(pid_file) as f:
                record = json.load(f)
            try:
                os.kill(record['pid'], 0)
                running = True
            except OSError:
                running = False

            info = {
                'status': 'running' if running else 'stale',
                'port': port,
                'pid': record['pid'],
                'model': record.get('model'),
                'started_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(record['started_at'])),
            }
            if not running:
                pid_file.unlink(missing_ok=True)
            return info

        servers = self.list_servers()
        results = {}
        for p, s in servers.items():
            try:
                os.kill(s['pid'], 0)
                s['status'] = 'running'
            except OSError:
                s['status'] = 'stale'
                pid_file = self._pid_file(p)
                pid_file.unlink(missing_ok=True)
            results[p] = s
        return {'servers': results}

    def list_servers(self) -> Dict[int, Dict[str, Any]]:
        servers = {}
        if not PID_DIR.exists():
            return servers
        for f in PID_DIR.glob('*.json'):
            try:
                with open(f) as fh:
                    record = json.load(fh)
                servers[record['port']] = record
            except (json.JSONDecodeError, KeyError):
                continue
        detected = self._detect_llama_serve_processes()
        servers.update(detected)
        return servers

    def _pid_file(self, port: int) -> Path:
        return PID_DIR / f'{port}.json'

    def _detect_llama_serve_processes(self) -> Dict[int, Dict[str, Any]]:
        """Scan running processes for llama.cpp/llama-serve instances not tracked by PID files.

        Returns a dict mapping port → info dict with pid, model, cmdline, etc.
        """
        if psutil is None:
            return {}

        detected: Dict[int, Dict[str, Any]] = {}
        tracked_ports = set(self.list_servers().keys())

        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline') or []
                    if not cmdline:
                        continue
                    cmdline_str = ' '.join(str(c) for c in cmdline).lower()
                    if not any(kw in cmdline_str for kw in ['llama-server', 'llama.cpp', 'llama_cpp']):
                        continue

                    pid = proc.info['pid']
                    if pid == os.getpid():
                        continue

                    port = None
                    model = None
                    for i, arg in enumerate(cmdline):
                        arg_str = str(arg)
                        if arg_str == '--port' and i + 1 < len(cmdline):
                            try:
                                port = int(cmdline[i + 1])
                            except (ValueError, IndexError):
                                pass
                        elif arg_str == '--model' and i + 1 < len(cmdline):
                            model = str(cmdline[i + 1])

                    if port is None:
                        continue

                    if port not in tracked_ports:
                        detected[port] = {
                            'pid': pid,
                            'model': model,
                            'cmdline': cmdline,
                            'status': 'detected',
                            'tracked': False,
                            'name': proc.info.get('name'),
                            'create_time': proc.create_time(),
                        }
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception:
            pass

        return detected
