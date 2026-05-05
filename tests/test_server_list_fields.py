"""Tests for server list response fields (Issue 1).

Ensures GET /servers returns proper fields: id, name, uptimeSeconds, gpuInfo.
The frontend expects these fields on ServerInfo but the backend was only
returning port, pid, status, model, started_at.
"""

import json
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest


class TestServerListResponseFields:
    """Tests for server list response field completeness."""

    def test_server_list_returns_id_field(self):
        """GET /servers should include an 'id' field on each server."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext

        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {
            8080: {
                "pid": 1234,
                "model": "/models/llama.gguf",
                "started_at": time.time() - 3600,
                "port": 8080,
            }
        }

        mock_request = MagicMock()
        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        # Simulate GET /servers by calling the handler directly
        from http.server import BaseHTTPRequestHandler

        # We need to mock the socket-level parts
        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        assert len(responses) == 1
        status, data = responses[0]
        assert status == 200
        assert isinstance(data, list)
        assert len(data) > 0
        assert "id" in data[0], f"Server response missing 'id' field. Keys: {list(data[0].keys())}"

    def test_server_list_returns_name_field(self):
        """GET /servers should include a 'name' field derived from model stem."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {
            8080: {
                "pid": 1234,
                "model": "/models/my-special-model.gguf",
                "started_at": time.time() - 3600,
                "port": 8080,
            }
        }

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert status == 200
        assert "name" in data[0], f"Server response missing 'name' field. Keys: {list(data[0].keys())}"
        assert data[0]["name"] == "my-special-model", f"Expected name 'my-special-model', got '{data[0]['name']}'"

    def test_server_list_returns_uptime_seconds(self):
        """GET /servers should include 'uptimeSeconds' computed from started_at."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        now = time.time()
        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {
            8080: {
                "pid": 1234,
                "model": "/models/test.gguf",
                "started_at": now - 7200,  # started 2 hours ago
                "port": 8080,
            }
        }

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert status == 200
        assert "uptimeSeconds" in data[0], f"Server response missing 'uptimeSeconds' field. Keys: {list(data[0].keys())}"
        uptime = data[0]["uptimeSeconds"]
        assert isinstance(uptime, (int, float)), f"uptimeSeconds should be numeric, got {type(uptime)}"
        assert 7000 <= uptime <= 7300, f"Expected ~7200s uptime, got {uptime}"

    def test_server_list_port_as_string_id(self):
        """Server 'id' should be the port as a string."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {
            12345: {
                "pid": 9999,
                "model": "/models/llama.gguf",
                "started_at": time.time(),
                "port": 12345,
            }
        }

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert data[0]["id"] == "12345", f"Expected id '12345', got '{data[0]['id']}'"

    def test_server_list_empty_when_no_servers(self):
        """GET /servers returns empty list when no servers are running."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {}

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert status == 200
        assert data == []

    def test_server_list_stale_status(self):
        """Stale servers (PID not alive) should have status 'stale'."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {
            8080: {
                "pid": 99999,  # non-existent PID
                "model": "/models/test.gguf",
                "started_at": time.time(),
                "port": 8080,
            }
        }

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert data[0]["status"] == "stale", f"Expected 'stale' status, got '{data[0]['status']}'"

    def test_server_list_multiple_servers(self):
        """GET /servers returns all servers with proper fields."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        now = time.time()
        mock_ctx = MagicMock(spec=ServerContext)
        mock_ctx.process_manager.list_servers.return_value = {
            8080: {
                "pid": 1001,
                "model": "/models/llama-3.1.gguf",
                "started_at": now - 1800,
                "port": 8080,
            },
            9090: {
                "pid": 1002,
                "model": "/models/mixtral-8x7b.gguf",
                "started_at": now - 600,
                "port": 9090,
            },
        }

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/servers"
        handler.headers = {}

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_GET()

        status, data = responses[0]
        assert len(data) == 2
        for server in data:
            assert "id" in server
            assert "name" in server
            assert "uptimeSeconds" in server
            assert "port" in server
            assert "status" in server
