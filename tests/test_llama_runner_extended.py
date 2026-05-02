# Extended test suite for LlamaRunner — coverage gaps
import asyncio
import logging
import subprocess
import unittest
from unittest.mock import patch, MagicMock
from backend.config import LlamaConfig
from backend.llama_runner import LlamaRunner, _values_equal, DEFAULT_ARGS


class TestFindLlamaExecutable(unittest.TestCase):
    """Tests for LlamaRunner._find_llama_executable."""

    @patch("shutil.which")
    def test_returns_first_found(self, mock_which):
        mock_which.side_effect = lambda name: {"llama-cli": "/usr/bin/llama-cli"}.get(name)
        result = LlamaRunner._find_llama_executable()
        self.assertEqual(result, "llama-cli")

    @patch("shutil.which")
    def test_falls_through_to_default(self, mock_which):
        mock_which.return_value = None
        result = LlamaRunner._find_llama_executable()
        self.assertEqual(result, "llama-server")


class TestClampNPredict(unittest.TestCase):
    """Tests for LlamaRunner._clamp_n_predict."""

    def test_negative_one_passthrough(self):
        self.assertEqual(LlamaRunner._clamp_n_predict(-1), -1)

    def test_clamps_below_one_to_one(self):
        with self.assertLogs("root", level="WARNING") as cm:
            result = LlamaRunner._clamp_n_predict(0)
        self.assertEqual(result, 1)
        self.assertIn("clamping to 1", cm.output[0])

    def test_clamps_above_4096_to_4096(self):
        with self.assertLogs("root", level="WARNING") as cm:
            result = LlamaRunner._clamp_n_predict(5000)
        self.assertEqual(result, 4096)
        self.assertIn("clamping to 4096", cm.output[0])

    def test_valid_value_unchanged(self):
        self.assertEqual(LlamaRunner._clamp_n_predict(256), 256)


class TestValuesEqual(unittest.TestCase):
    """Tests for the _values_equal helper."""

    def test_equal_ints(self):
        self.assertTrue(_values_equal(1, 1))

    def test_unequal_ints(self):
        self.assertFalse(_values_equal(1, 2))

    def test_close_floats_within_tolerance(self):
        self.assertTrue(_values_equal(1.0, 1.0 + 1e-10))

    def test_different_floats_outside_tolerance(self):
        self.assertFalse(_values_equal(1.0, 1.1))

    def test_mixed_types_not_equal(self):
        self.assertFalse(_values_equal(1, "1"))

    def test_both_floats_exact_match(self):
        self.assertTrue(_values_equal(0.8, 0.8))


class TestGenerateCommandEdgeCases(unittest.TestCase):
    """Tests for generate_command edge cases not covered by existing tests."""

    def setUp(self):
        self.mock_config = LlamaConfig()
        self.runner = LlamaRunner(self.mock_config)
        self.model_path = "/path/to/model.gguf"

    def test_custom_options_merge(self):
        custom = {"temp": 0.5, "n_predict": 128}
        cmd = self.runner.generate_command(self.model_path, custom_options=custom)
        self.assertIn("--temp", cmd)
        self.assertIn("0.5", cmd)
        self.assertIn("--n-predict", cmd)
        self.assertIn("128", cmd)

    def test_rope_freq_base_positive_included(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"rope_freq_base": 500000}
        )
        self.assertIn("--rope-freq-base", cmd)
        self.assertIn("500000", cmd)

    def test_rope_freq_base_zero_skipped(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"rope_freq_base": 0}
        )
        self.assertNotIn("--rope-freq-base", cmd)

    def test_keep_live_positive_included(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"keep_live": 30}
        )
        self.assertIn("--keep-live", cmd)
        self.assertIn("30", cmd)

    def test_keep_live_zero_skipped(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"keep_live": 0}
        )
        self.assertNotIn("--keep-live", cmd)

    def test_unknown_key_in_custom_options_ignored(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"unknown_key": "value"}
        )
        self.assertNotIn("unknown_key", " ".join(cmd))

    def test_numa_false_skipped(self):
        """numa=False should not appear because the transform returns (None, None)."""
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"numa": False}
        )
        self.assertNotIn("--numa", cmd)

    def test_numa_true_included(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"numa": True}
        )
        self.assertIn("--numa", cmd)

    def test_rope_scaling_nonempty_included(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"rope_scaling": "dist"}
        )
        self.assertIn("--rope-scaling", cmd)
        self.assertIn("dist", cmd)

    def test_rope_scaling_empty_string_skipped(self):
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"rope_scaling": ""}
        )
        self.assertNotIn("--rope-scaling", cmd)

    def test_n_predict_clamped_in_generate_command(self):
        """n_predict > 4096 should be clamped inside generate_command."""
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"n_predict": 10000}
        )
        idx = cmd.index("--n-predict")
        self.assertEqual(cmd[idx + 1], "4096")

    def test_default_options_not_in_command(self):
        """Values matching defaults should be omitted."""
        cmd = self.runner.generate_command(
            self.model_path, custom_options={"top_k": 40}  # default
        )
        self.assertNotIn("--top-k", cmd)

    def test_command_starts_with_llama_cli(self):
        cmd = self.runner.generate_command(self.model_path)
        self.assertEqual(cmd[0], self.runner.llama_cli)
        self.assertEqual(cmd[1], "-m")
        self.assertEqual(cmd[2], self.model_path)


class TestGetCommandPreview(unittest.TestCase):
    """Tests for LlamaRunner.get_command_preview."""

    @patch.object(LlamaRunner, "generate_command", return_value=["llama-server", "-m", "/models/model.gguf"])
    def test_preview_joins_command(self, mock_gen):
        preview = LlamaRunner.get_command_preview(
            "/models/model.gguf", {"temp": 0.5}
        )
        self.assertIsInstance(preview, str)
        self.assertEqual(preview, "llama-server -m /models/model.gguf")


class TestRunModelSyncErrorPaths(unittest.TestCase):
    """Tests for run_model_sync error paths."""

    def setUp(self):
        self.mock_config = LlamaConfig()
        self.runner = LlamaRunner(self.mock_config)

    @patch("backend.llama_runner.subprocess.run")
    def test_called_process_error_raises_runtime_error(self, mock_run):
        exc = subprocess.CalledProcessError(1, "cmd", stderr="bad stuff")
        mock_run.side_effect = exc
        with self.assertRaisesRegex(RuntimeError, "Return Code 1"):
            self.runner.run_model_sync("/model.gguf", "prompt")

    @patch("backend.llama_runner.subprocess.run")
    def test_file_not_found_raises_runtime_error(self, mock_run):
        mock_run.side_effect = FileNotFoundError("no exe")
        with self.assertRaisesRegex(RuntimeError, "not found"):
            self.runner.run_model_sync("/model.gguf", "prompt")

    @patch("backend.llama_runner.subprocess.run")
    def test_generic_exception_raises_runtime_error(self, mock_run):
        mock_run.side_effect = OSError("disk full")
        with self.assertRaisesRegex(
            RuntimeError, "Failed to run llama.cpp process synchronously"
        ):
            self.runner.run_model_sync("/model.gguf", "prompt")

    @patch("backend.llama_runner.subprocess.run")
    def test_success_returns_stdout(self, mock_run):
        mock_proc = MagicMock()
        mock_proc.stdout = "generated text"
        mock_run.return_value = mock_proc
        result = self.runner.run_model_sync("/model.gguf", "prompt")
        self.assertEqual(result, "generated text")


class TestRunModelAsyncErrorPaths(unittest.TestCase):
    """Tests for run_model_async error paths."""

    def setUp(self):
        self.mock_config = LlamaConfig()
        self.runner = LlamaRunner(self.mock_config)

    @patch("backend.llama_runner.subprocess.run")
    def test_called_process_error_raises_runtime_error(self, mock_run):
        exc = subprocess.CalledProcessError(2, "cmd", stderr="async err")
        mock_run.side_effect = exc
        loop = asyncio.new_event_loop()
        try:
            with self.assertRaisesRegex(RuntimeError, "Return Code 2"):
                loop.run_until_complete(
                    self.runner.run_model_async("/model.gguf", "prompt")
                )
        finally:
            loop.close()

    @patch("backend.llama_runner.subprocess.run")
    def test_file_not_found_raises_runtime_error(self, mock_run):
        mock_run.side_effect = FileNotFoundError("no exe")
        loop = asyncio.new_event_loop()
        try:
            with self.assertRaisesRegex(RuntimeError, "not found"):
                loop.run_until_complete(
                    self.runner.run_model_async("/model.gguf", "prompt")
                )
        finally:
            loop.close()

    @patch("backend.llama_runner.subprocess.run")
    def test_generic_exception_raises_runtime_error(self, mock_run):
        mock_run.side_effect = OSError("timeout")
        loop = asyncio.new_event_loop()
        try:
            with self.assertRaisesRegex(
                RuntimeError, "Failed to run llama.cpp process asynchronously"
            ):
                loop.run_until_complete(
                    self.runner.run_model_async("/model.gguf", "prompt")
                )
        finally:
            loop.close()

    @patch("backend.llama_runner.subprocess.run")
    def test_success_returns_stdout(self, mock_run):
        mock_proc = MagicMock()
        mock_proc.stdout = "async result"
        mock_run.return_value = mock_proc
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                self.runner.run_model_async("/model.gguf", "prompt")
            )
            self.assertEqual(result, "async result")
        finally:
            loop.close()


class TestLlamaRunnerInit(unittest.TestCase):
    """Tests for LlamaRunner.__init__."""

    @patch("shutil.which", return_value="/usr/bin/llama-server")
    def test_init_sets_llama_cli(self, mock_which):
        runner = LlamaRunner(LlamaConfig())
        self.assertEqual(runner.llama_cli, "llama-server")


if __name__ == "__main__":
    unittest.main()
