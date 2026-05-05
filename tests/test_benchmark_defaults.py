"""Tests for benchmark default prompts (Issue 4).

Ensures that run_benchmark uses default prompts when none are provided,
and that the benchmark handler uses appropriate defaults.
"""

from unittest.mock import patch, MagicMock
import pytest

from backend.benchmark import run_benchmark, BenchmarkType


class TestBenchmarkDefaultPrompts:
    """Tests for benchmark default prompt handling."""

    def test_run_benchmark_without_prompt_raises_for_throughput(self):
        """Empty prompt with THROUGHPUT type should raise ValueError (no default)."""
        with pytest.raises(ValueError, match="Prompt must be provided"):
            run_benchmark("/path/to/model.gguf", "", {}, benchmark_type=BenchmarkType.THROUGHPUT)

    def test_run_benchmark_without_prompt_uses_default_for_perplexity(self):
        """Empty prompt with PERPLEXITY type should use default prompt."""
        result = run_benchmark(
            "/path/to/model.gguf",
            "",
            {},
            benchmark_type=BenchmarkType.PERPLEXITY,
        )
        assert "metrics" in result
        assert result["benchmark_type"] == BenchmarkType.PERPLEXITY
        assert len(result["prompt"]) > 0

    def test_run_benchmark_without_prompt_uses_default_for_kv_cache(self):
        """Empty prompt with KV_CACHE type should use default prompt."""
        result = run_benchmark(
            "/path/to/model.gguf",
            "",
            {},
            benchmark_type=BenchmarkType.KV_CACHE,
        )
        assert "metrics" in result
        assert result["benchmark_type"] == BenchmarkType.KV_CACHE

    def test_run_benchmark_without_prompt_uses_default_for_latency(self):
        """Empty prompt with LATENCY type should use default prompt."""
        result = run_benchmark(
            "/path/to/model.gguf",
            "",
            {},
            benchmark_type=BenchmarkType.LATENCY,
        )
        assert "metrics" in result
        assert result["benchmark_type"] == BenchmarkType.LATENCY

    def test_run_benchmark_with_custom_prompt(self):
        """Custom prompt should be used instead of default."""
        custom = "This is my custom prompt for testing."
        result = run_benchmark(
            "/path/to/model.gguf",
            custom,
            {},
            benchmark_type=BenchmarkType.THROUGHPUT,
        )
        assert result["prompt"] == custom

    def test_run_benchmark_synthetic_mode_produces_valid_metrics(self):
        """Synthetic benchmark mode should produce valid metric structure."""
        result = run_benchmark(
            "/mock/model.gguf",
            "Test prompt",
            {},
        )
        assert result["mode"] in ("real", "synthetic")
        assert "metrics" in result
        metrics = result["metrics"]
        assert "first_token_latency_ms" in metrics
        assert "end_to_end_latency_ms" in metrics
        assert "throughput_tokens_per_second" in metrics
        assert "memory_usage_mb" in metrics

    def test_run_benchmark_deterministic_synthetic(self):
        """Synthetic benchmarks should produce deterministic results."""
        result1 = run_benchmark(
            "/mock/model.gguf",
            "Deterministic test",
            {},
        )
        result2 = run_benchmark(
            "/mock/model.gguf",
            "Deterministic test",
            {},
        )
        assert result1["generated_tokens"] == result2["generated_tokens"]
        assert result1["metrics"]["first_token_latency_ms"] == result2["metrics"]["first_token_latency_ms"]


class TestBenchmarkHandlerDefaults:
    """Tests for the benchmark handler endpoint with default prompts."""

    def test_benchmark_handler_with_empty_prompt_uses_default(self):
        """POST /benchmark/run should not fail when prompt is empty."""
        from backend.api_server import APIHandler
        from backend.context import ServerContext
        from http.server import BaseHTTPRequestHandler

        mock_ctx = MagicMock(spec=ServerContext)

        handler = APIHandler.__new__(APIHandler)
        handler.ctx = mock_ctx
        handler.path = "/benchmark/run"
        handler.headers = {"Content-Type": "application/json", "Content-Length": str(len('{"model": "/models/test.gguf"}'))}

        # Mock _read_body to return the request body without prompt
        original_read_body = handler._read_body
        def mock_read_body():
            return {"model": "/models/test.gguf"}
        handler._read_body = mock_read_body

        responses = []

        def capture_send_json(status, data):
            responses.append((status, data))

        handler._send_json = capture_send_json

        with patch.object(BaseHTTPRequestHandler, '__init__', lambda *a, **k: None):
            handler.do_POST()

        # The handler should not return a 500 error for missing prompt
        status, data = responses[0]
        assert status == 200, f"Expected 200, got {status}: {data}"
