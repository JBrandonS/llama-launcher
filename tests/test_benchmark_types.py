# tests/test_benchmark_types.py
"""Tests for the multi-type benchmarking system (throughput, perplexity, kv_cache,
quantize_quality, latency)."""
import subprocess
import unittest
from unittest.mock import MagicMock, patch

from backend.benchmark import (
    BenchmarkType,
    _PROMPT_DEFAULT,
    _build_bench_command,
    _build_perplexity_command,
    _parse_bench_output,
    parse_benchmark_output,
    _parse_perplexity_output,
    _run_latency_benchmark,
    run_benchmark,
)


# ---------------------------------------------------------------------------
# BenchmarkType enum
# ---------------------------------------------------------------------------

class TestBenchmarkTypeEnum(unittest.TestCase):
    """Verify the enum values."""

    def test_all_types_present(self):
        expected = {"throughput", "perplexity", "kv_cache",
                     "quantize_quality", "latency"}
        actual = {bt.value for bt in BenchmarkType}
        self.assertEqual(actual, expected)


# ---------------------------------------------------------------------------
# parse_benchmark_output (unchanged — smoke test)
# ---------------------------------------------------------------------------

class TestParseBenchmarkOutput(unittest.TestCase):
    """Smoke-test the existing parser still works."""

    def test_tokens_per_second(self):
        output = "tokens per second: 23.32\n" \
                 "      total time = 3600.75 ms\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['real_tokens_per_second'], 23.32, places=1)

    def test_empty_string(self):
        result = parse_benchmark_output("")
        self.assertEqual(result, {})


# ---------------------------------------------------------------------------
# Perplexity parser
# ---------------------------------------------------------------------------

class TestPerplexityParser(unittest.TestCase):
    """Tests for _parse_perplexity_output."""

    def test_perplexity_line(self):
        output = "llama.cpp: perplexity: 7.2345\n"
        result = _parse_perplexity_output(output)
        self.assertAlmostEqual(result['perplexity'], 7.2345, places=2)

    def test_avg_loss_line(self):
        output = "avg loss: 1.9876\n"
        result = _parse_perplexity_output(output)
        self.assertAlmostEqual(result['avg_loss'], 1.9876, places=2)

    def test_malformed(self):
        result = _parse_perplexity_output("no metrics here\n")
        self.assertEqual(result, {})


# ---------------------------------------------------------------------------
# KV-cache bench parser
# ---------------------------------------------------------------------------

class TestBenchParser(unittest.TestCase):
    """Tests for _parse_bench_output."""

    def test_ms_per_token(self):
        output = "ms/token: 0.456\n"
        result = _parse_bench_output(output)
        self.assertAlmostEqual(result['ms_per_token'], 0.456, places=3)
        # Efficiency = 1 / ms_per_token
        self.assertAlmostEqual(result['kv_cache_efficiency'], 1/0.456, delta=0.01)

    def test_kv_throughput(self):
        output = "eval: 1200.5 tokens/s\n"
        result = _parse_bench_output(output)
        self.assertAlmostEqual(result['kv_throughput_tokens_per_second'], 1200.5, places=1)

    def test_ctx_length(self):
        output = "ctx=4096 ms/token=0.3\n"
        result = _parse_bench_output(output)
        self.assertEqual(result['context_length'], 4096)

    def test_empty(self):
        self.assertEqual(_parse_bench_output(""), {})


# ---------------------------------------------------------------------------
# Command builders for new types
# ---------------------------------------------------------------------------

class TestNewCommandBuilders(unittest.TestCase):
    """Tests for _build_perplexity_command and _build_bench_command."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_perplexity_no_binary(self, mock_which):
        self.assertEqual(_build_perplexity_command("/model.gguf", "text", {}), [])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-perplexity')
    def test_perplexity_command_structure(self, mock_which):
        result = _build_perplexity_command("/model.gguf", "hello", {'threads': 4})
        self.assertIn('/usr/bin/llama-perplexity', result[0])
        self.assertEqual(result[1], '-m')
        self.assertIn('--threads', result)

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_bench_no_binary(self, mock_which):
        self.assertEqual(_build_bench_command("/model.gguf", {}), [])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-bench')
    def test_bench_command_structure(self, mock_which):
        result = _build_bench_command("/model.gguf", {'threads': 8})
        self.assertIn('/usr/bin/llama-bench', result[0])
        self.assertIn('--kv-batch', result)


# ---------------------------------------------------------------------------
# run_benchmark — throughput (existing, sanity check)
# ---------------------------------------------------------------------------

class TestRunBenchmarkThroughput(unittest.TestCase):
    """Verify throughput benchmark returns correct type and structure."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_synthetic_throughput(self, mock_which):
        result = run_benchmark("/model.gguf", "prompt", {}, benchmark_type="throughput")
        self.assertEqual(result['benchmark_type'], BenchmarkType.THROUGHPUT)
        self.assertEqual(result['mode'], 'synthetic')
        self.assertIn('throughput_tokens_per_second', result['metrics'])

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_default_is_throughput(self, mock_which):
        """Default benchmark_type should be throughput."""
        result = run_benchmark("/model.gguf", "prompt", {})
        self.assertEqual(result['benchmark_type'], BenchmarkType.THROUGHPUT)


# ---------------------------------------------------------------------------
# run_benchmark — perplexity
# ---------------------------------------------------------------------------

class TestRunBenchmarkPerplexity(unittest.TestCase):
    """Tests for the perplexity benchmark type."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_synthetic_perplexity(self, mock_which):
        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="perplexity")
        self.assertEqual(result['benchmark_type'], BenchmarkType.PERPLEXITY)
        self.assertEqual(result['mode'], 'synthetic')
        self.assertIn('perplexity', result['metrics'])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-perplexity')
    @patch('backend.benchmark.subprocess.run')
    def test_real_perplexity(self, mock_run, mock_which):
        proc = MagicMock()
        proc.stdout = "perplexity: 6.5432\n"
        proc.stderr = ""
        proc.returncode = 0
        proc.elapsed = 1.2
        mock_run.return_value = proc

        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="perplexity")
        self.assertEqual(result['benchmark_type'], BenchmarkType.PERPLEXITY)
        self.assertEqual(result['mode'], 'real')
        self.assertAlmostEqual(result['metrics']['perplexity'], 6.5432, places=1)


# ---------------------------------------------------------------------------
# run_benchmark — kv_cache
# ---------------------------------------------------------------------------

class TestRunBenchmarkKVCache(unittest.TestCase):
    """Tests for the KV-cache benchmark type."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_synthetic_kv_cache(self, mock_which):
        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="kv_cache")
        self.assertEqual(result['benchmark_type'], BenchmarkType.KV_CACHE)
        self.assertEqual(result['mode'], 'synthetic')
        self.assertIn('kv_cache_efficiency', result['metrics'])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-bench')
    @patch('backend.benchmark.subprocess.run')
    def test_real_kv_cache(self, mock_run, mock_which):
        proc = MagicMock()
        proc.stdout = "ms/token: 0.350\nctx=2048\n"
        proc.stderr = ""
        proc.returncode = 0
        proc.elapsed = 5.0
        mock_run.return_value = proc

        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="kv_cache")
        self.assertEqual(result['benchmark_type'], BenchmarkType.KV_CACHE)
        self.assertEqual(result['mode'], 'real')
        self.assertAlmostEqual(result['metrics']['ms_per_token'], 0.350, places=3)


# ---------------------------------------------------------------------------
# run_benchmark — quantize_quality
# ---------------------------------------------------------------------------

class TestRunBenchmarkQuantizeQuality(unittest.TestCase):
    """Tests for the quantization quality benchmark type."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_synthetic_quantize(self, mock_which):
        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="quantize_quality")
        self.assertEqual(result['benchmark_type'], BenchmarkType.QUANTIZE_QUALITY)
        self.assertEqual(result['mode'], 'synthetic')
        self.assertIn('perplexity_original', result['metrics'])
        self.assertIn('perplexity_quantized', result['metrics'])
        self.assertIn('quality_degradation_pct', result['metrics'])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-perplexity')
    @patch('backend.benchmark.subprocess.run')
    def test_real_quantize(self, mock_run, mock_which):
        proc = MagicMock()
        proc.stdout = "perplexity: 5.1234\n"
        proc.stderr = ""
        proc.returncode = 0
        proc.elapsed = 2.0
        mock_run.return_value = proc

        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="quantize_quality")
        self.assertEqual(result['benchmark_type'], BenchmarkType.QUANTIZE_QUALITY)
        self.assertEqual(result['mode'], 'real')
        self.assertAlmostEqual(result['metrics']['perplexity_original'], 5.1234, places=2)
        self.assertIn('quality_degradation_pct', result['metrics'])


# ---------------------------------------------------------------------------
# run_benchmark — latency
# ---------------------------------------------------------------------------

class TestRunBenchmarkLatency(unittest.TestCase):
    """Tests for the latency benchmark type."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_synthetic_latency(self, mock_which):
        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="latency")
        self.assertEqual(result['benchmark_type'], BenchmarkType.LATENCY)
        self.assertIn('ttft_ms', result['metrics'])
        self.assertIn('tpot_ms', result['metrics'])
        self.assertIn('prompt_variants', result['metrics'])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    @patch('backend.benchmark.subprocess.run')
    def test_real_latency(self, mock_run, mock_which):
        proc = MagicMock()
        proc.stdout = "hello world test"
        proc.stderr = ""
        proc.returncode = 0
        mock_run.return_value = proc

        result = run_benchmark("/model.gguf", "text", {}, benchmark_type="latency")
        self.assertEqual(result['benchmark_type'], BenchmarkType.LATENCY)
        self.assertEqual(result['mode'], 'real')
        self.assertIn('prompt_variants', result['metrics'])
        # Should have 3 variants: short, medium, long
        self.assertEqual(len(result['metrics']['prompt_variants']), 3)


# ---------------------------------------------------------------------------
# Unified result structure across all types
# ---------------------------------------------------------------------------

class TestUnifiedResultStructure(unittest.TestCase):
    """Every benchmark type should return the same top-level keys."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_all_types_have_required_keys(self, mock_which):
        expected_keys = {'model_path', 'prompt', 'options', 'benchmark_type',
                         'generated_tokens', 'metrics', 'summary', 'mode'}
        for bt in BenchmarkType:
            result = run_benchmark("/model.gguf", "text", {}, benchmark_type=bt.value)
            self.assertTrue(expected_keys.issubset(set(result.keys())),
                            f"Missing keys for {bt.value}")

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_all_types_non_negative_metrics(self, mock_which):
        for bt in BenchmarkType:
            result = run_benchmark("/model.gguf", "text", {}, benchmark_type=bt.value)
            self.assertGreaterEqual(result['generated_tokens'], 0)
            # Check that all numeric metrics are non-negative
            for k, v in result['metrics'].items():
                if isinstance(v, (int, float)):
                    self.assertGreaterEqual(v, 0, f"Negative metric {k}={v} for {bt.value}")

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_deterministic_within_type(self, mock_which):
        for bt in BenchmarkType:
            r1 = run_benchmark("/model.gguf", "text", {}, benchmark_type=bt.value)
            r2 = run_benchmark("/model.gguf", "text", {}, benchmark_type=bt.value)
            self.assertEqual(r1['generated_tokens'], r2['generated_tokens'])


# ---------------------------------------------------------------------------
# Prompt default sentinel
# ---------------------------------------------------------------------------

class TestPromptDefault(unittest.TestCase):
    """Test that _PROMPT_DEFAULT triggers type-specific defaults."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_prompt_default_for_non_throughput(self, mock_which):
        """Using _PROMPT_DEFAULT should fill in the default prompt for the type."""
        result = run_benchmark("/model.gguf", _PROMPT_DEFAULT, {},
                               benchmark_type="perplexity")
        self.assertIn("The sky is blue because molecules", result['prompt'])
        self.assertEqual(result['benchmark_type'], BenchmarkType.PERPLEXITY)

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_empty_prompt_still_raises_for_throughput(self, mock_which):
        """Empty prompt with throughput (default type) should still raise."""
        with self.assertRaises(ValueError):
            run_benchmark("/model.gguf", "", {}, benchmark_type="throughput")


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

class TestInputValidation(unittest.TestCase):
    """Input validation for all types."""

    def test_empty_model_path(self):
        with self.assertRaises(ValueError):
            run_benchmark("", "prompt", {}, benchmark_type="perplexity")

    def test_non_dict_options(self):
        with self.assertRaises(ValueError):
            run_benchmark("/model.gguf", "prompt", "bad", benchmark_type="perplexity")

    def test_none_options_uses_empty_dict(self):
        result = run_benchmark("/model.gguf", "prompt", None, benchmark_type="perplexity")
        self.assertEqual(result['options'], {})


if __name__ == '__main__':
    unittest.main()
