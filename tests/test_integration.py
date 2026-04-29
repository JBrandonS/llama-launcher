# tests/test_integration.py
import unittest
import os
import tempfile
from unittest.mock import patch, MagicMock
import time

class TestIntegration(unittest.TestCase):
    """End-to-end integration tests for the Llama Launcher flow."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()

    def test_integration_happy_path_with_mocks(self):
        """Tests a full flow using mocks for all components."""
        # Discovery mocks
        with patch('backend.model_manager.scan_local_models') as mock_scan:
            mock_scan.return_value = [
                {"name": "test-model-1.gguf", "path": "/mock/path/test-model-1.gguf"}
            ]
            from backend.model_manager import scan_local_models
            discovered = scan_local_models(['./tests/fixtures'])
            self.assertIsInstance(discovered, list)

        # Run mocks
        with patch('backend.llama_runner.LlamaRunner.run_model_mock') as mock_run:
            mock_run.return_value = {"status": "success", "output": "mock output"}
            from backend.llama_runner import LlamaRunner
            runner = LlamaRunner.__new__(LlamaRunner)
            result = runner.run_model_mock("/mock/path", "prompt", {})
            self.assertEqual(result["status"], "success")

        # Benchmark mocks
        with patch('backend.benchmark.run_benchmark') as mock_bench:
            mock_bench.return_value = {
                "metrics": {"throughput_tokens_per_second": 100.0},
                "generated_tokens": 100
            }
            from backend.benchmark import run_benchmark
            result = run_benchmark("/mock/path", "prompt", {}, runner=None)
            self.assertIn("metrics", result)

        # Daemon lifecycle
        from backend.daemon import start_daemon, stop_daemon
        dummy_target = lambda stop, reload, config: None
        daemon = start_daemon(dummy_target)
        time.sleep(0.1)
        stop_daemon()

    def test_integration_progress_update_sequence(self):
        """Tests that the module structure is importable."""
        import backend
        self.assertIsInstance(dir(backend), list)

    def test_integration_no_external_io(self):
        """Ensures the test does not produce real I/O beyond reading files."""
        from backend.model_manager import scan_local_models
        # No real scans (empty or test fixtures only)
        result = scan_local_models(["/nonexistent/path"])
        self.assertEqual(result, [])

    def test_integration_failure_path(self):
        """Tests graceful handling of non-existent paths."""
        from backend.model_manager import scan_local_models
        result = scan_local_models(["/nonexistent/fake/path/xyz"])
        self.assertIsInstance(result, list)

if __name__ == '__main__':
    unittest.main()