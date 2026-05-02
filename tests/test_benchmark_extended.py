# tests/test_benchmark_extended.py
import subprocess
import unittest
from unittest.mock import MagicMock, patch

from backend.benchmark import parse_benchmark_output, _build_command, run_benchmark


class TestParseBenchmarkOutput(unittest.TestCase):
    """Tests for parsing various llama-cli output formats."""

    def test_tokens_per_second(self):
        """Test parsing 'tokens per second: X' lines (no 'eval' in line)."""
        output = "tokens per second: 23.32\n" \
                 "      total time = 3600.75 ms\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['real_tokens_per_second'], 23.32, places=1)

    def test_tokens_per_second_malformed(self):
        """Test that malformed 'tokens per second' lines are gracefully skipped."""
        output = "tokens per second: not_a_number\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('real_tokens_per_second', result)

    def test_prompt_eval_speed_parser_empty(self):
        """Test that prompt eval parser returns empty for common formats it can't handle."""
        output = "prompt eval speed: 1234.5 tokens/s\n"
        result = parse_benchmark_output(output)
        # Parser splits by 'tokens/s' and tries to parse the part before as float
        # "prompt eval speed: 1234.5" can't be parsed as float
        self.assertNotIn('prompt_eval_speed', result)

    def test_prompt_eval_speed_malformed(self):
        """Test that malformed prompt eval lines are gracefully skipped."""
        output = "prompt eval: not_a_number tokens/s\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('prompt_eval_speed', result)

    def test_eval_speed_parser_empty(self):
        """Test that eval parser returns empty for common formats it can't handle."""
        output = "eval speed: 987.6 tokens/s\n"
        result = parse_benchmark_output(output)
        # Parser splits by 'tokens/s' and tries to parse the part before as float
        self.assertNotIn('eval_speed', result)

    def test_eval_speed_malformed(self):
        """Test that malformed eval lines are gracefully skipped."""
        output = "eval: not_a_number tokens/s\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('eval_speed', result)

    def test_gpu_memory(self):
        """Test parsing 'gpu_memory: X' lines (key must be 'gpu' and 'memory')."""
        output = "gpu_memory: 1234.56\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['gpu_mem_alloc'], 1234.56, places=1)

    def test_gpu_memory_with_commas(self):
        """Test parsing GPU memory with comma-formatted numbers."""
        output = "gpu_memory: 1,234.56\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['gpu_mem_alloc'], 1234.56, places=1)

    def test_gpu_memory_malformed(self):
        """Test that malformed GPU memory lines are gracefully skipped."""
        output = "gpu_memory: not_a_number\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('gpu_mem_alloc', result)

    def test_total_time(self):
        """Test parsing 'total time: X' lines (key must have 'total' and 'time')."""
        output = "Total Time: 45.67\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['total_time'], 45.67, places=1)

    def test_total_time_malformed(self):
        """Test that malformed total time lines are gracefully skipped."""
        output = "Total Time: not_a_number\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('total_time', result)

    def test_load_duration(self):
        """Test parsing 'load duration: X ms' lines."""
        output = "load duration: 2345.67 ms\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['load_time'], 2345.67, places=1)

    def test_load_duration_malformed(self):
        """Test that malformed load duration lines are gracefully skipped."""
        output = "load duration: not_a_number ms\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('load_time', result)

    def test_generated_tokens_no_marker(self):
        """Test that token counting is skipped without the marker."""
        output = "Hello world\n" \
                 "This is a test\n"
        result = parse_benchmark_output(output)
        self.assertNotIn('generated_tokens', result)

    def test_empty_string(self):
        """Test parsing an empty string returns empty dict."""
        result = parse_benchmark_output("")
        self.assertEqual(result, {})

    def test_no_matching_lines(self):
        """Test that completely irrelevant output returns empty dict."""
        result = parse_benchmark_output("some random text with no metrics\n")
        self.assertEqual(result, {})

    def test_multiple_metrics_together(self):
        """Test parsing multiple metric types from the same output."""
        output = "tokens per second: 23.32\n" \
                 "gpu_memory: 1234.56\n" \
                 "Total Time: 45.67\n" \
                 "load duration: 2345.67 ms\n"
        result = parse_benchmark_output(output)
        self.assertAlmostEqual(result['real_tokens_per_second'], 23.32, places=1)
        self.assertAlmostEqual(result['gpu_mem_alloc'], 1234.56, places=1)
        self.assertAlmostEqual(result['total_time'], 45.67, places=1)
        self.assertAlmostEqual(result['load_time'], 2345.67, places=1)


class TestBuildCommand(unittest.TestCase):
    """Tests for _build_command function."""

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_no_llama_cli_returns_empty(self, mock_which):
        """Test that _build_command returns [] when llama-cli is not found."""
        result = _build_command("/path/to/model.gguf", "prompt", {})
        self.assertEqual(result, [])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    def test_basic_command_structure(self, mock_which):
        """Test basic command structure with default options."""
        result = _build_command("/path/to/model.gguf", "hello world", {})
        self.assertIn('/usr/bin/llama-cli', result[0])
        self.assertEqual(result[1], '-m')
        self.assertEqual(result[2], '/path/to/model.gguf')
        self.assertIn('--prompt', result)
        self.assertIn('hello world', result)
        self.assertIn('-n', result)

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    def test_custom_options_included(self, mock_which):
        """Test that custom options are added to the command."""
        options = {
            'temp': 0.7,
            'top_k': 20,
            'top_p': 0.9,
            'threads': 4,
            'n_ctx': 2048,
            'n_gpu_layers': 33,
        }
        result = _build_command("/path/to/model.gguf", "prompt", options)
        self.assertIn('--temp', result)
        self.assertIn('0.7', result)
        self.assertIn('--top-k', result)
        self.assertIn('20', result)
        self.assertIn('--threads', result)
        self.assertIn('4', result)

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    def test_none_options_ignored(self, mock_which):
        """Test that None option values are not included."""
        options = {'temp': None, 'threads': 4}
        result = _build_command("/path/to/model.gguf", "prompt", options)
        self.assertNotIn('--temp', result)
        self.assertIn('--threads', result)

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    def test_n_predict_default(self, mock_which):
        """Test that n_predict defaults to 128."""
        result = _build_command("/path/to/model.gguf", "prompt", {})
        idx = result.index('-n')
        self.assertEqual(result[idx + 1], '128')

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    def test_n_predict_custom(self, mock_which):
        """Test that custom n_predict is used."""
        result = _build_command("/path/to/model.gguf", "prompt", {'n_predict': 512})
        idx = result.index('-n')
        self.assertEqual(result[idx + 1], '512')


class TestRunBenchmark(unittest.TestCase):
    """Tests for run_benchmark function."""

    def test_input_validation_empty_model_path(self):
        """Test that empty model_path raises ValueError."""
        with self.assertRaises(ValueError):
            run_benchmark("", "prompt", {})

    def test_input_validation_empty_prompt(self):
        """Test that empty prompt raises ValueError."""
        with self.assertRaises(ValueError):
            run_benchmark("/path/to/model.gguf", "", {})

    def test_input_validation_non_dict_options(self):
        """Test that non-dict options raise ValueError."""
        with self.assertRaises(ValueError):
            run_benchmark("/path/to/model.gguf", "prompt", "not_a_dict")

    @patch('backend.benchmark.shutil.which', return_value=None)
    def test_synthetic_fallback_no_llama_cli(self, mock_which):
        """Test synthetic fallback when llama-cli is not available."""
        result = run_benchmark("/path/to/model.gguf", "prompt", {})
        self.assertEqual(result['mode'], 'synthetic')
        self.assertIn('model_path', result)
        self.assertIn('metrics', result)
        self.assertIn('generated_tokens', result)
        self.assertIn('summary', result)
        self.assertIn('llama-cli binary not found', result['summary'])

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    @patch('backend.benchmark.subprocess.run', side_effect=subprocess.TimeoutExpired(cmd='llama-cli', timeout=120))
    def test_timeout_fallback_to_synthetic(self, mock_run, mock_which):
        """Test that subprocess timeout falls back to synthetic metrics."""
        result = run_benchmark("/path/to/model.gguf", "prompt", {})
        self.assertEqual(result['mode'], 'synthetic')

    @patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli')
    @patch('backend.benchmark.subprocess.run', side_effect=FileNotFoundError)
    def test_file_not_found_fallback_to_synthetic(self, mock_run, mock_which):
        """Test that FileNotFoundError falls back to synthetic metrics."""
        result = run_benchmark("/path/to/model.gguf", "prompt", {})
        self.assertEqual(result['mode'], 'synthetic')

    def test_custom_runner_with_output_string(self):
        """Test custom runner returning dict with 'output' string."""
        def mock_runner(model_path, prompt, options):
            return {"output": "hello world test"}

        result = run_benchmark("/path", "prompt", {}, runner=mock_runner)
        self.assertEqual(result['generated_tokens'], 3)  # 3 words
        self.assertIn('metrics', result)
        self.assertIn('mode', result)

    def test_custom_runner_with_command_list(self):
        """Test custom runner returning dict with 'command' list."""
        def mock_runner(model_path, prompt, options):
            return {"command": ["echo", "hello"]}

        result = run_benchmark("/path", "prompt", {}, runner=mock_runner)
        self.assertIn('metrics', result)
        self.assertIn('mode', result)

    def test_custom_runner_returns_non_dict(self):
        """Test that non-dict runner result falls through to direct execution."""
        called_build = [False]

        def mock_runner(model_path, prompt, options):
            return "not a dict"

        with patch('backend.benchmark._build_command', return_value=['llama-cli', '-m', '/path']):
            with patch('backend.benchmark.shutil.which', return_value='/usr/bin/llama-cli'):
                with patch('backend.benchmark.subprocess.run', side_effect=FileNotFoundError):
                    result = run_benchmark("/path", "prompt", {}, runner=mock_runner)
                    # Should fall through to synthetic fallback
                    self.assertEqual(result['mode'], 'synthetic')

    def test_custom_runner_exception_falls_through(self):
        """Test that runner exception falls through to direct execution."""
        def mock_runner(model_path, prompt, options):
            raise RuntimeError("runner failed")

        with patch('backend.benchmark.shutil.which', return_value=None):
            result = run_benchmark("/path", "prompt", {}, runner=mock_runner)
            self.assertEqual(result['mode'], 'synthetic')

    def test_return_structure_has_all_keys(self):
        """Test that every benchmark result has all expected keys."""
        with patch('backend.benchmark.shutil.which', return_value=None):
            result = run_benchmark("/path/to/model.gguf", "prompt", {})
        expected_keys = {
            'model_path', 'prompt', 'options', 'generated_tokens',
            'metrics', 'summary', 'mode'
        }
        self.assertTrue(expected_keys.issubset(set(result.keys())))

    def test_metrics_has_required_fields(self):
        """Test that metrics dict has all required fields."""
        with patch('backend.benchmark.shutil.which', return_value=None):
            result = run_benchmark("/path/to/model.gguf", "prompt", {})
        required_metric_keys = {
            'first_token_latency_ms', 'end_to_end_latency_ms',
            'throughput_tokens_per_second', 'memory_usage_mb'
        }
        self.assertTrue(required_metric_keys.issubset(set(result['metrics'].keys())))

    def test_metrics_are_non_negative(self):
        """Test that metrics stay non-negative."""
        with patch('backend.benchmark.shutil.which', return_value=None):
            result = run_benchmark("/path/to/model.gguf", "Prompt text.", {})

        self.assertGreaterEqual(result['generated_tokens'], 0)
        self.assertGreaterEqual(result['metrics']['first_token_latency_ms'], 0)
        self.assertGreaterEqual(result['metrics']['end_to_end_latency_ms'], 0)
        self.assertGreaterEqual(result['metrics']['throughput_tokens_per_second'], 0)
        self.assertGreaterEqual(result['metrics']['memory_usage_mb'], 0)

    def test_mode_field_present(self):
        """Test that every benchmark result has a mode field."""
        with patch('backend.benchmark.shutil.which', return_value=None):
            result = run_benchmark("/path/to/model.gguf", "Prompt text.", {})
        self.assertIn(result['mode'], ('real', 'synthetic'))

    def test_deterministic_seed_based_metrics(self):
        """Test that metrics are deterministic for the same inputs."""
        with patch('backend.benchmark.shutil.which', return_value=None):
            result_1 = run_benchmark("/path/to/model.gguf", "Prompt text.", {})
            result_2 = run_benchmark("/path/to/model.gguf", "Prompt text.", {})

        self.assertEqual(result_1['generated_tokens'], result_2['generated_tokens'])
        self.assertEqual(
            result_1['metrics']['first_token_latency_ms'],
            result_2['metrics']['first_token_latency_ms']
        )

    def test_different_inputs_produce_different_metrics(self):
        """Test that different inputs produce different deterministic metrics."""
        with patch('backend.benchmark.shutil.which', return_value=None):
            result_1 = run_benchmark("/path/model1.gguf", "Prompt A.", {})
            result_2 = run_benchmark("/path/model2.gguf", "Prompt B.", {})

        self.assertNotEqual(
            result_1['metrics']['first_token_latency_ms'],
            result_2['metrics']['first_token_latency_ms']
        )


if __name__ == '__main__':
    unittest.main()
