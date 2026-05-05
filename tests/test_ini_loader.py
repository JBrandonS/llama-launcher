"""Tests for INI file loading (Issue 5).

Ensures backend can read INI files from a directory, parse server configs,
and support launching servers from loaded configs.
"""

import os
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest


class TestIniLoader:
    """Tests for INI file loading functionality."""

    def test_load_ini_files_from_directory(self, tmp_path):
        """load_server_configs reads all .ini files from a directory."""
        # Create test INI files
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()

        # Server 1 INI
        (ini_dir / "server1.ini").write_text(
            "[server]\nhost = 127.0.0.1\nport = 8080\n\n"
            "[model]\npath = /models/llama.gguf\nctx-size = 4096\n\n"
            "[sampling]\ntemp = 0.7\ntop-k = 40\ntop-p = 0.95\n"
        )

        # Server 2 INI
        (ini_dir / "server2.ini").write_text(
            "[server]\nhost = 127.0.0.1\nport = 9090\n\n"
            "[model]\npath = /models/mixtral.gguf\nctx-size = 8192\n\n"
            "[sampling]\ntemp = 0.5\ntop-k = 30\ntop-p = 0.9\n"
        )

        # Non-INI file should be ignored
        (ini_dir / "readme.txt").write_text("This is not a config")

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert len(configs) == 2
        assert any(c["port"] == 8080 for c in configs)
        assert any(c["port"] == 9090 for c in configs)

    def test_load_ini_files_empty_directory(self, tmp_path):
        """load_server_configs returns empty list for directory with no INI files."""
        ini_dir = tmp_path / "empty_servers"
        ini_dir.mkdir()

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert configs == []

    def test_load_ini_files_nonexistent_directory(self):
        """load_server_configs returns empty list for nonexistent directory."""
        from backend.ini_writer import load_server_configs
        configs = load_server_configs("/nonexistent/path")

        assert configs == []

    def test_load_ini_parses_model_path(self, tmp_path):
        """load_server_configs correctly extracts model path from INI."""
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "test.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/custom-model.gguf\nctx-size = 2048\n"
        )

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert len(configs) == 1
        assert configs[0]["model"] == "/models/custom-model.gguf"

    def test_load_ini_parses_context_size(self, tmp_path):
        """load_server_configs correctly extracts context size from INI."""
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "test.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\nctx-size = 16384\n"
        )

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert configs[0]["context_size"] == 16384

    def test_load_ini_parses_sampling_params(self, tmp_path):
        """load_server_configs correctly extracts sampling parameters."""
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "test.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\nctx-size = 4096\n\n"
            "[sampling]\ntemp = 0.3\ntop-k = 20\ntop-p = 0.99\n"
        )

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert configs[0]["temperature"] == 0.3
        assert configs[0]["top_k"] == 20
        assert configs[0]["top_p"] == 0.99

    def test_load_ini_uses_defaults_for_missing_values(self, tmp_path):
        """load_server_configs uses defaults when INI values are missing."""
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "minimal.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\n"
        )

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        # Should have defaults for ctx-size, temp, top-k, top-p
        assert configs[0]["context_size"] == 2048  # default
        assert configs[0]["temperature"] == 0.7   # default
        assert configs[0]["top_k"] == 40          # default
        assert configs[0]["top_p"] == 0.95        # default

    def test_load_ini_ignores_empty_files(self, tmp_path):
        """load_server_configs skips empty INI files."""
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "empty.ini").write_text("")
        (ini_dir / "valid.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\n"
        )

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert len(configs) == 1

    def test_load_ini_ignores_invalid_ini_files(self, tmp_path):
        """load_server_configs skips INI files that cannot be parsed."""
        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "invalid.ini").write_text("this is not valid ini [[[[\n")
        (ini_dir / "valid.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\n"
        )

        from backend.ini_writer import load_server_configs
        configs = load_server_configs(str(ini_dir))

        assert len(configs) == 1


class TestIniLoadEndpoint:
    """Tests for the GET /ini-servers endpoint."""

    def test_ini_load_endpoint_returns_configs(self, tmp_path):
        """GET /ini-servers returns parsed server configs from directory."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "test.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\nctx-size = 4096\n"
        )

        mock_ctx = MagicMock(spec=ServerContext)
        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = f"/ini-servers?dir={ini_dir}"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert status == 200
        assert "configs" in data or isinstance(data, list)

    def test_ini_load_endpoint_invalid_dir(self):
        """GET /ini-servers with nonexistent directory returns empty list."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        mock_ctx = MagicMock(spec=ServerContext)
        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/ini-servers?dir=/nonexistent/path"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert status == 200


class TestIniLaunchEndpoint:
    """Tests for the POST /ini-launch endpoint."""

    def test_ini_launch_endpoint_starts_server(self, tmp_path):
        """POST /ini-launch starts a server from INI config."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        ini_dir = tmp_path / "servers"
        ini_dir.mkdir()
        (ini_dir / "test.ini").write_text(
            "[server]\nport = 8080\n\n"
            "[model]\npath = /models/test.gguf\nctx-size = 4096\n"
        )

        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.start_server.return_value = {
            "status": "started",
            "pid": 1234,
            "port": 8080,
        }

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/ini-launch"
        handler.headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(
                '{"config_path": "' + str(ini_dir / "test.ini") + '"}'
            )),
        }

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        def mock_read_body():
            return {"config_path": str(ini_dir)}

        handler._read_body = mock_read_body

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_POST()

        status, data = responses[0]
        assert status == 200
        # Verify start_server was called with correct params
        mock_ctx.process_manager.start_server.assert_called_once()
        call_kwargs = mock_ctx.process_manager.start_server.call_args[1]
        assert call_kwargs["model_path"] == "/models/test.gguf"
        assert call_kwargs["port"] == 8080
