# tests/test_benchmark.py
import unittest
from unittest.mock import MagicMock
from llama_launcher.benchmark import run_benchmark

class TestBenchmark(unittest.TestCase):
    """Tests the run_benchmark function for input validation and deterministic output."""

    def test_run_benchmark_basic(self):
        """Tests the happy path: run_benchmark returns a valid result."""
        model_path = "/mock/models/test.gguf"
        prompt = "Explain quantum computing"
        options = {"temp": 0.7}
        
        result = run_benchmark(model_path, prompt, options)
        
        # Verify structure
        self.assertIn("model_path", result)
        self.assertIn("metrics", result)
        self.assertEqual(result["model_path"], model_path)
        
        # Verify metrics
        self.assertIn("first_token_latency_ms", result["metrics"])
        self.assertIn("end_to_end_latency_ms", result["metrics"])
        self.assertIn("throughput_tokens_per_second", result["metrics"])
        
    def test_run_benchmark_input_validation(self):
        """Tests that invalid inputs raise ValueError as expected."""
        with self.assertRaises(ValueError):
            run_benchmark("", "prompt", {})
            
        with self.assertRaises(ValueError):
            run_benchmark("/path", "", {})
            
    def test_run_benchmark_options_error(self):
        """Tests that options type validation works."""
        with self.assertRaises(ValueError):
            run_benchmark("/path", "prompt", "not_a_dict")

    def test_run_benchmark_deterministic_results(self):
        """Tests that repeated calls yield identical results."""
        model_path = "/mock/models/deterministic.gguf"
        prompt = "Test determinism"
        options = {}
        
        result_1 = run_benchmark(model_path, prompt, options)
        result_2 = run_benchmark(model_path, prompt, options)
        
        self.assertEqual(result_1["generated_tokens"], result_2["generated_tokens"])
        self.assertEqual(result_1["metrics"]["first_token_latency_ms"], result_2["metrics"]["first_token_latency_ms"])

    def test_run_benchmark_runner_integration(self):
        """Tests that a custom runner is invoked."""
        mock_runner = MagicMock(return_value={"status": "mock"})
        
        result = run_benchmark("/path", "prompt", {}, runner=mock_runner)
        
        # Verify the custom runner was called
        mock_runner.assert_called_once()
        
    def test_run_benchmark_metrics_are_non_negative(self):
        """Tests that metrics stay non-negative."""
        result = run_benchmark("/path/to/model.gguf", "Prompt text.", {})
        
        self.assertGreaterEqual(result["generated_tokens"], 0)
        self.assertGreaterEqual(result["metrics"]["first_token_latency_ms"], 0)
        self.assertGreaterEqual(result["metrics"]["end_to_end_latency_ms"], 0)
        self.assertGreaterEqual(result["metrics"]["throughput_tokens_per_second"], 0)
        self.assertGreaterEqual(result["metrics"]["memory_usage_mb"], 0)

if __name__ == '__main__':
    unittest.main()