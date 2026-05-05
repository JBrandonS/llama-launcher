"""Tests for log parsing and daemon logs (Issue 3).

Ensures logs page handles missing log files, various log formats,
and properly parses daemon/server log entries.
"""

import json
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest


class TestDaemonLogsEndpoint:
    """Tests for GET /daemon/logs endpoint."""

    def test_daemon_logs_returns_entries_when_log_exists(self, tmp_path):
        """GET /daemon/logs returns parsed entries when launcher.log exists."""
        from backend.api_server import APIHandler, LOG_DIR as api_log_dir
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        log_dir = tmp_path / "logs"
        log_dir.mkdir()
        log_file = log_dir / "launcher.log"

        # Write some JSON log entries
        entries = [
            {"timestamp": "2024-01-15T10:30:00", "level": "INFO", "component": "api_server", "message": "Server started"},
            {"timestamp": "2024-01-15T10:31:00", "level": "ERROR", "component": "process_manager", "message": "Failed to start"},
        ]
        log_file.write_text("\n".join(json.dumps(e) for e in entries) + "\n")

        original_log_dir = api_log_dir
        import backend.api_server as api_module
        api_module.LOG_DIR = log_dir

        try:
            mock_ctx = MagicMock(spec=ServerContext)
            handler = APIHandler.__new__(APIHandler)
            handler.ctx = mock_ctx
            handler.path = "/daemon/logs"
            handler.headers = {}

            responses = []

            def capture_send_json(status, data):
                responses.append((status, data))

            handler._send_json = capture_send_json

            with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
                handler.do_GET()

            status, data = responses[0]
            assert status == 200
            assert "entries" in data
            assert len(data["entries"]) == 2
            assert data["entries"][0]["message"] == "Server started"
            assert data["entries"][1]["level"] == "ERROR"
        finally:
            api_module.LOG_DIR = original_log_dir

    def test_daemon_logs_returns_empty_when_no_log_file(self, tmp_path):
        """GET /daemon/logs returns empty entries when launcher.log doesn't exist."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler
        import backend.api_server as api_module

        log_dir = tmp_path / "logs"
        log_dir.mkdir()

        original_log_dir = api_module.LOG_DIR
        api_module.LOG_DIR = log_dir

        try:
            mock_ctx = MagicMock(spec=ServerContext)
            handler = APIHandler.__new__(APIHandler)
            handler.ctx = mock_ctx
            handler.path = "/daemon/logs"
            handler.headers = {}

            responses = []

            def capture_send_json(status, data):
                responses.append((status, data))

            handler._send_json = capture_send_json

            with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
                handler.do_GET()

            status, data = responses[0]
            assert status == 200
            assert "entries" in data
            assert data["entries"] == []
        finally:
            api_module.LOG_DIR = original_log_dir

    def test_daemon_logs_parses_non_json_lines(self, tmp_path):
        """GET /daemon/logs gracefully handles non-JSON lines."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler
        import backend.api_server as api_module

        log_dir = tmp_path / "logs"
        log_dir.mkdir()
        log_file = log_dir / "launcher.log"

        # Mix of JSON and plain text lines
        log_file.write_text(
            '{"timestamp": "2024-01-15T10:30:00", "level": "INFO", "component": "api", "message": "OK"}\n'
            "This is a plain text line\n"
            '{"timestamp": "2024-01-15T10:31:00", "level": "ERROR", "component": "process", "message": "Fail"}\n'
        )

        original_log_dir = api_module.LOG_DIR
        api_module.LOG_DIR = log_dir

        try:
            mock_ctx = MagicMock(spec=ServerContext)
            handler = APIHandler.__new__(APIHandler)
            handler.ctx = mock_ctx
            handler.path = "/daemon/logs"
            handler.headers = {}

            responses = []

            def capture_send_json(status, data):
                responses.append((status, data))

            handler._send_json = capture_send_json

            with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
                handler.do_GET()

            status, data = responses[0]
            assert status == 200
            assert len(data["entries"]) == 3
            # Plain text line should still be captured
            assert data["entries"][1]["message"] == "This is a plain text line"
        finally:
            api_module.LOG_DIR = original_log_dir

    def test_daemon_logs_respects_limit(self, tmp_path):
        """GET /daemon/logs respects the limit query parameter."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler
        import backend.api_server as api_module

        log_dir = tmp_path / "logs"
        log_dir.mkdir()
        log_file = log_dir / "launcher.log"

        # Write 100 entries
        lines = []
        for i in range(100):
            entry = {"timestamp": f"2024-01-15T10:{i//60:02d}:{i%60:02d}", "level": "INFO", "component": "api", "message": f"Entry {i}"}
            lines.append(json.dumps(entry))
        log_file.write_text("\n".join(lines) + "\n")

        original_log_dir = api_module.LOG_DIR
        api_module.LOG_DIR = log_dir

        try:
            mock_ctx = MagicMock(spec=ServerContext)
            handler = APIHandler.__new__(APIHandler)
            handler.ctx = mock_ctx
            handler.path = "/daemon/logs?limit=10"
            handler.headers = {}

            responses = []

            def capture_send_json(status, data):
                responses.append((status, data))

            handler._send_json = capture_send_json

            with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
                handler.do_GET()

            status, data = responses[0]
            assert status == 200
            assert len(data["entries"]) == 10
        finally:
            api_module.LOG_DIR = original_log_dir


class TestServerLogParsing:
    """Tests for _parse_server_log_line static method."""

    def test_parse_timestamped_log_line(self):
        """Parse log line with timestamp in brackets."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "[2024-01-15 10:30:45 +0000] [INFO] ggml_init: loading model",
            "8080"
        )

        assert result["timestamp"] == "2024-01-15T10:30:45 +0000"
        assert result["level"] == "INFO"
        assert result["serverId"] == "8080"
        assert "ggml_init" in result["message"]

    def test_parse_error_log_line(self):
        """Parse log line starting with 'error:'."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "error: failed to load model",
            "8080"
        )

        assert result["level"] == "ERROR"
        assert result["message"] == "failed to load model"

    def test_parse_warn_log_line(self):
        """Parse log line starting with 'warn:'."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "warn: context size exceeded",
            "8080"
        )

        assert result["level"] == "WARNING"
        assert result["message"] == "context size exceeded"

    def test_parse_bracketed_error_level(self):
        """Parse log line with [ERROR] bracket."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "[ERROR] failed to load model: file not found",
            "8080"
        )

        assert result["level"] == "ERROR"
        assert result["message"] == "failed to load model: file not found"

    def test_parse_llama_prefix(self):
        """Parse log line with llama.cpp prefix."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "llama_model_load: loaded 7B parameters",
            "8080"
        )

        assert result["level"] == "INFO"
        assert result["message"] == "llama_model_load: loaded 7B parameters"

    def test_parse_plain_error_line(self):
        """Parse plain text line containing error keyword."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "Exception occurred during inference",
            "8080"
        )

        assert result["level"] == "ERROR"

    def test_parse_warn_keyword_in_line(self):
        """Parse plain text line containing warning keyword."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "Some warning message here",
            "8080"
        )

        assert result["level"] == "WARNING"

    def test_parse_plain_info_line(self):
        """Parse plain text line without any markers defaults to INFO."""
        from backend.api_server import APIHandler

        result = APIHandler._parse_server_log_line(
            "Just a plain info message",
            "8080"
        )

        assert result["level"] == "INFO"


class TestGetLogsEndpoint:
    """Tests for GET /logs endpoint."""

    def test_get_logs_with_server_filter(self, tmp_path):
        """GET /logs?server=8080 returns only logs for that server."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler
        from backend import constants

        log_dir = tmp_path / "logs"
        log_dir.mkdir()

        # Create server_8080.log
        server_log = log_dir / "server_8080.log"
        server_log.write_text("[INFO] Server 8080 started\n")

        # Create server_9090.log
        server_log_2 = log_dir / "server_9090.log"
        server_log_2.write_text("[INFO] Server 9090 started\n")

        original_log_dir = constants.LOG_DIR
        constants.LOG_DIR = log_dir

        try:
            mock_ctx = MagicMock(spec=ServerContext)
            handler = APIHandler.__new__(APIHandler)
            handler.ctx = mock_ctx
            handler.path = "/logs?server=8080"
            handler.headers = {}

            responses = []

            def capture_send_json(status, data):
                responses.append((status, data))

            handler._send_json = capture_send_json

            with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
                handler.do_GET()

            status, data = responses[0]
            assert status == 200
            # Should only have logs from server_8080.log
            for entry in data["entries"]:
                assert entry.get("serverId") == "8080" or entry.get("component") == "llama-server"
        finally:
            constants.LOG_DIR = original_log_dir

    def test_get_logs_with_level_filter(self, tmp_path):
        """GET /logs?level=ERROR returns only ERROR level entries."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler
        from backend import constants

        log_dir = tmp_path / "logs"
        log_dir.mkdir()

        # Create launcher.log with mixed levels
        launcher_log = log_dir / "launcher.log"
        launcher_log.write_text(
            json.dumps({"timestamp": "2024-01-15T10:30:00", "level": "INFO", "component": "api", "message": "OK"}) + "\n"
            + json.dumps({"timestamp": "2024-01-15T10:31:00", "level": "ERROR", "component": "process", "message": "Fail"}) + "\n"
            + json.dumps({"timestamp": "2024-01-15T10:32:00", "level": "WARNING", "component": "api", "message": "Warn"}) + "\n"
        )

        original_log_dir = constants.LOG_DIR
        constants.LOG_DIR = log_dir

        try:
            mock_ctx = MagicMock(spec=ServerContext)
            handler = APIHandler.__new__(APIHandler)
            handler.ctx = mock_ctx
            handler.path = "/logs?level=ERROR"
            handler.headers = {}

            responses = []

            def capture_send_json(status, data):
                responses.append((status, data))

            handler._send_json = capture_send_json

            with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
                handler.do_GET()

            status, data = responses[0]
            assert status == 200
            for entry in data["entries"]:
                assert entry["level"] == "ERROR"
        finally:
            constants.LOG_DIR = original_log_dir
