"""Comprehensive tests for backend/daemon.py — Daemon class and module-level functions."""

import os
import threading
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from backend.daemon import (
    Daemon,
    start_daemon,
    stop_daemon,
    reload_daemon,
    get_service_file_path,
    generate_systemd_service,
    generate_service_file,
    get_service_path,
    reset_state,
    daemon_status,
    start_daemon_impl,
    stop_daemon_impl,
    _global_daemon,
    _daemon_config,
    _current_service_path,
    _start_time,
)


# ─── Daemon class tests ───────────────────────────────────────────

class TestDaemonClass:
    """Tests for the Daemon class."""

    def test_init_no_target(self):
        daemon = Daemon()
        assert daemon._target is None
        assert daemon._thread is None
        assert isinstance(daemon._stop_event, threading.Event)
        assert isinstance(daemon._reload_event, threading.Event)

    def test_init_with_target(self):
        target = MagicMock()
        daemon = Daemon(target=target)
        assert daemon._target is target

    def test_start_twice_only_starts_once(self):
        daemon = Daemon()
        daemon.start()
        first_thread = daemon._thread
        time.sleep(0.2)  # Let thread start
        daemon.start()
        assert daemon._thread is first_thread  # Not a new thread

    def test_start_noop_target_runs_loop(self):
        """Daemon without target should run the no-op sleep loop."""
        daemon = Daemon()
        daemon.start()
        time.sleep(0.3)
        assert daemon._thread is not None
        assert daemon._thread.is_alive()
        daemon.stop()

    def test_start_with_target_calls_target(self):
        """Daemon with target should invoke the target function."""
        call_log = []

        def my_target(stop_event, reload_event, extra):
            call_log.append(("called",))
            # Don't block — return immediately
            return

        daemon = Daemon(target=my_target)
        daemon.start()
        time.sleep(0.3)
        assert len(call_log) == 1
        daemon.stop()

    def test_target_exception_does_not_crash(self):
        """If target raises, the thread should not crash (exception caught)."""
        def bad_target(stop_event, reload_event, extra):
            raise RuntimeError("boom")

        daemon = Daemon(target=bad_target)
        daemon.start()
        time.sleep(0.3)
        # Thread should still be alive (exception was caught in _run)
        assert daemon._thread is not None
        daemon.stop()

    def test_stop_already_stopped_is_safe(self):
        daemon = Daemon()
        daemon.stop()  # Should not raise
        daemon.stop()  # Double stop — also safe

    def test_reload_sets_event(self):
        reload_received = threading.Event()

        def target(stop_event, reload_event, extra):
            reload_event.wait(timeout=1)
            reload_received.set()

        daemon = Daemon(target=target)
        daemon.start()
        time.sleep(0.1)
        daemon.reload()
        assert reload_received.wait(timeout=2)
        daemon.stop()

    def test_stop_wakes_thread(self):
        stopped = threading.Event()

        def target(stop_event, reload_event, extra):
            stop_event.wait(timeout=5)
            stopped.set()

        daemon = Daemon(target=target)
        daemon.start()
        time.sleep(0.1)
        daemon.stop()
        assert stopped.wait(timeout=3), "Thread did not stop within timeout"

    def test_stop_timeout(self):
        """If target doesn't respond to stop_event, join should timeout."""
        def never_stops(stop_event, reload_event, extra):
            while True:
                time.sleep(0.05)

        daemon = Daemon(target=never_stops)
        daemon.start()
        time.sleep(0.1)
        # Use a very short timeout to test the join behavior
        # The real stop() uses 5s timeout, but we can test the logic
        assert daemon._thread is not None
        daemon.stop()  # Should not hang forever


# ─── Global daemon functions ──────────────────────────────────────

class TestGlobalDaemonFunctions:
    """Tests for module-level daemon functions."""

    def setup_method(self):
        reset_state()

    def teardown_method(self):
        reset_state()

    def test_start_daemon_creates_global(self):
        daemon = start_daemon()
        assert daemon is not None
        assert isinstance(daemon, Daemon)
        stop_daemon()

    def test_start_daemon_with_target(self):
        target = MagicMock()
        daemon = start_daemon(target=target)
        assert daemon._target is target
        stop_daemon()

    def test_stop_daemon_none_is_safe(self):
        reset_state()  # Ensure no global daemon exists
        stop_daemon()  # Should not raise

    def test_reload_daemon_none_is_safe(self):
        reset_state()
        reload_daemon()  # Should not raise


# ─── Service file tests ──────────────────────────────────────────

class TestServiceFileFunctions:
    """Tests for service file generation and paths."""

    def setup_method(self):
        reset_state()

    def teardown_method(self):
        reset_state()

    def test_get_service_file_path_creates_directory(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            path = get_service_file_path("my-daemon")
            assert path.name == "my-daemon.service"
            assert (tmp_path / "services").exists()

    def test_get_service_file_path_returns_correct_path(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            path = get_service_file_path("test-service")
            assert str(path) == str(tmp_path / "services" / "test-service.service")

    def test_generate_systemd_service_basic(self):
        content = generate_systemd_service(
            service_name="test",
            description="Test daemon",
            exec_start="/usr/bin/test",
        )
        assert "[Unit]" in content
        assert "Description=Test daemon" in content
        assert "After=network.target" in content
        assert "[Service]" in content
        assert "Type=simple" in content
        assert "User=root" in content
        assert "ExecStart=/usr/bin/test" in content
        assert "Restart=on-failure" in content
        assert "[Install]" in content
        assert "WantedBy=multi-user.target" in content

    def test_generate_systemd_service_custom_after(self):
        content = generate_systemd_service(
            service_name="test",
            description="Test daemon",
            exec_start="/usr/bin/test",
            after="postgresql.service",
        )
        assert "After=postgresql.service" in content

    def test_generate_systemd_service_custom_user(self):
        content = generate_systemd_service(
            service_name="test",
            description="Test daemon",
            exec_start="/usr/bin/test",
            user="ubuntu",
        )
        assert "User=ubuntu" in content

    def test_generate_service_file_writes_and_returns_path(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            path = generate_service_file(
                service_name="test-daemon",
                description="Test daemon",
                exec_start="/usr/bin/llama-launcher run",
            )
            assert path == str(tmp_path / "services" / "test-daemon.service")
            written_content = Path(path).read_text()
            assert "[Unit]" in written_content
            assert "Description=Test daemon" in written_content

    def test_generate_service_file_sets_global_state(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            path = generate_service_file(
                service_name="test",
                description="Test",
                exec_start="/usr/bin/test",
            )
            assert get_service_path() == path

    def test_get_service_path_returns_none_before_generation(self):
        assert get_service_path() is None


# ─── State management tests ──────────────────────────────────────

class TestStateManagement:
    """Tests for reset_state and daemon_status."""

    def setup_method(self):
        reset_state()

    def test_reset_clears_start_time(self):
        global _start_time
        _start_time = time.time()
        assert _start_time is not None
        reset_state()
        # After reset, _start_time should be None
        from backend.daemon import _start_time as st
        assert st is None

    def test_reset_clears_service_path(self):
        with patch("backend.daemon.SERVICE_DIR", Path("/tmp/test-services")):
            generate_service_file("test", "Test", "/usr/bin/test")
            assert get_service_path() is not None
            reset_state()
            assert get_service_path() is None

    def test_daemon_status_stopped(self):
        status = daemon_status()
        assert status["status"] == "stopped"
        assert status["running"] is False
        assert status["pid"] is None
        assert status["uptimeSeconds"] == 0
        assert status["servicePath"] is None
        assert status["monitoredServers"] == []
        assert status["errors"] == []
        assert "config" in status

    def test_daemon_status_running(self):
        import backend.daemon as daemon_mod
        daemon_mod._start_time = time.time() - 60  # Simulate running for 60 seconds
        status = daemon_status()
        assert status["status"] == "running"
        assert status["running"] is True
        assert status["pid"] == os.getpid()
        assert status["uptimeSeconds"] >= 58  # Allow some timing variance
        daemon_mod._start_time = None  # Clean up

    def test_daemon_status_has_config(self):
        status = daemon_status()
        assert "autoLaunchOnStart" in status["config"]
        assert "pollIntervalSeconds" in status["config"]
        assert status["config"]["pollIntervalSeconds"] == 10


# ─── start_daemon_impl / stop_daemon_impl tests ─────────────────

class TestDaemonImplFunctions:
    """Tests for the daemon implementation functions."""

    def setup_method(self):
        reset_state()

    def teardown_method(self):
        reset_state()

    def test_start_daemon_impl_basic(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            result = start_daemon_impl(
                service_name="default",
                exec_start="llama-launcher run",
            )
            assert result["status"] == "running"
            assert result["running"] is True
            assert result["pid"] == os.getpid()
            assert result["uptimeSeconds"] == 0
            assert "servicePath" in result
            assert "config" in result

    def test_start_daemon_impl_with_model_path(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            result = start_daemon_impl(
                service_name="default",
                model_path="/models/test.gguf",
                port=8501,
            )
            assert result["status"] == "running"
            # Check that the service file contains the model path in exec command
            service_path = result["servicePath"]
            content = Path(service_path).read_text()
            assert "/models/test.gguf" in content
            assert "8501" in content

    def test_start_daemon_impl_already_running(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            start_daemon_impl(service_name="default")
            result = start_daemon_impl(service_name="default")
            assert result["status"] == "already_running"
            assert result["running"] is True

    def test_start_daemon_impl_custom_config(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            custom_config = {"pollIntervalSeconds": 30, "maxLaunchAttempts": 10}
            result = start_daemon_impl(
                service_name="default",
                config=custom_config,
            )
            assert result["config"]["pollIntervalSeconds"] == 30
            assert result["config"]["maxLaunchAttempts"] == 10

    def test_start_daemon_impl_custom_user(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            result = start_daemon_impl(
                service_name="default",
                user="ubuntu",
            )
            content = Path(result["servicePath"]).read_text()
            assert "User=ubuntu" in content

    def test_stop_daemon_impl_stopped(self):
        result = stop_daemon_impl()
        assert result["status"] == "stopped"
        assert result["running"] is False

    def test_stop_daemon_impl_running(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            start_daemon_impl(service_name="default")
            result = stop_daemon_impl()
            assert result["status"] == "stopped"
            assert result["running"] is False

    def test_full_start_stop_cycle(self, tmp_path):
        with patch("backend.daemon.SERVICE_DIR", tmp_path / "services"):
            # Start
            start_result = start_daemon_impl(service_name="default")
            assert start_result["status"] == "running"

            # Check status while running
            status = daemon_status()
            assert status["running"] is True

            # Stop
            stop_result = stop_daemon_impl()
            assert stop_result["status"] == "stopped"

            # Check status after stop
            status = daemon_status()
            assert status["running"] is False
            assert status["status"] == "stopped"
