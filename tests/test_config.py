# tests/test_config.py
"""Tests for backend/config.py — config loading, CLI parsing, env overrides, and validation."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

import yaml
from pydantic import ValidationError

from backend.config import (
    LlamaConfig,
    parse_cli_args,
    load_config,
    _expand_path,
)
from backend.exceptions import ConfigurationError
from types import SimpleNamespace


class TestExpandPath(unittest.TestCase):
    """Tests for the _expand_path helper."""

    def test_expand_path_with_pathlib_path(self):
        p = Path("~/some/path")
        result = _expand_path(p)
        self.assertIsInstance(result, Path)
        self.assertEqual(result.expanduser(), result)

    def test_expand_path_with_string(self):
        result = _expand_path("~/some/string/path")
        self.assertIsInstance(result, Path)
        self.assertTrue("some" in str(result))

    def test_expand_path_raises_on_invalid_type(self):
        with self.assertRaises(ValueError):
            _expand_path(123)

        with self.assertRaises(ValueError):
            _expand_path(None)  # type: ignore


class TestLlamaConfigDefaults(unittest.TestCase):
    """Tests for LlamaConfig default values."""

    def test_default_values(self):
        config = LlamaConfig()
        self.assertIsInstance(config.default_model_path, Path)
        self.assertIsInstance(config.working_directory, Path)
        self.assertIsInstance(config.local_model_search_paths, list)
        self.assertEqual(config.server_port, 12345)
        self.assertEqual(config.n_ctx, 2048)
        self.assertEqual(config.n_gpu_layers, -1)
        self.assertEqual(config.temperature, 0.7)
        self.assertEqual(config.top_k, 40)
        self.assertEqual(config.top_p, 0.9)
        self.assertEqual(config.n_predict, 512)
        self.assertEqual(config.threads, 8)
        self.assertEqual(config.log_level, "INFO")
        self.assertIsNone(config.hf_api_key)

    def test_n_predict_clamp_below_one(self):
        """n_predict < 1 should be clamped to 1."""
        config = LlamaConfig(n_predict=0)
        self.assertEqual(config.n_predict, 1)

    def test_n_predict_clamp_above_4096(self):
        """n_predict > 4096 should be clamped to 4096."""
        config = LlamaConfig(n_predict=5000)
        self.assertEqual(config.n_predict, 4096)

    def test_n_predict_negative_one_kept(self):
        """n_predict == -1 (unlimited) should not be clamped."""
        config = LlamaConfig(n_predict=-1)
        self.assertEqual(config.n_predict, -1)

    def test_n_predict_valid_range_unchanged(self):
        """n_predict in valid range should remain unchanged."""
        config = LlamaConfig(n_predict=2048)
        self.assertEqual(config.n_predict, 2048)


class TestLlamaConfigPathExpansion(unittest.TestCase):
    """Tests for path expansion in LlamaConfig model validator."""

    def test_path_expansion_in_dict(self):
        config = LlamaConfig(default_model_path="~/custom/model.gguf")
        self.assertTrue(config.default_model_path.is_absolute() or "~" not in str(config.default_model_path))

    def test_working_directory_expansion(self):
        config = LlamaConfig(working_directory="~/my_models")
        expanded = Path(os.path.expanduser("~/my_models"))
        self.assertEqual(config.working_directory, expanded)

    def test_local_search_paths_expansion(self):
        config = LlamaConfig(local_model_search_paths=["~/models1", "~/models2"])
        for p in config.local_model_search_paths:
            self.assertIsInstance(p, Path)


class TestLlamaConfigValidation(unittest.TestCase):
    """Tests for LlamaConfig validation errors."""

    def test_invalid_server_port_too_low(self):
        with self.assertRaises(ValidationError):
            LlamaConfig(server_port=0)

    def test_invalid_server_port_too_high(self):
        with self.assertRaises(ValidationError):
            LlamaConfig(server_port=70000)


class TestParseCliArgs(unittest.TestCase):
    """Tests for parse_cli_args function."""

    @patch("backend.config.argparse.ArgumentParser")
    def test_parses_model_arg(self, MockParser):
        mock_parser = MockParser.return_value
        mock_parser.parse_known_args.return_value = (SimpleNamespace(model="/path/to/model.gguf", temp=None, n_ctx=None, log_level=None), [])
        result = parse_cli_args()
        self.assertEqual(result["model"], "/path/to/model.gguf")

    @patch("backend.config.argparse.ArgumentParser")
    def test_parses_temp_arg(self, MockParser):
        mock_parser = MockParser.return_value
        mock_parser.parse_known_args.return_value = (SimpleNamespace(model=None, temp=0.9, n_ctx=None, log_level=None), [])
        result = parse_cli_args()
        self.assertEqual(result["temp"], 0.9)

    @patch("backend.config.argparse.ArgumentParser")
    def test_parses_n_ctx_arg(self, MockParser):
        mock_parser = MockParser.return_value
        mock_parser.parse_known_args.return_value = (SimpleNamespace(model=None, temp=None, n_ctx=4096, log_level=None), [])
        result = parse_cli_args()
        self.assertEqual(result["n_ctx"], 4096)

    @patch("backend.config.argparse.ArgumentParser")
    def test_parses_log_level_arg(self, MockParser):
        mock_parser = MockParser.return_value
        mock_parser.parse_known_args.return_value = (SimpleNamespace(model=None, temp=None, n_ctx=None, log_level="DEBUG"), [])
        result = parse_cli_args()
        self.assertEqual(result["log_level"], "DEBUG")

    @patch("backend.config.argparse.ArgumentParser")
    def test_filters_none_values(self, MockParser):
        """Only non-None values should be returned."""
        mock_parser = MockParser.return_value
        # Use a simple Namespace-like object to avoid MagicMock __dict__ pollution
        from types import SimpleNamespace
        mock_parser.parse_known_args.return_value = (SimpleNamespace(model=None, temp=None, n_ctx=None, log_level=None), [])
        result = parse_cli_args()
        self.assertEqual(result, {})


class TestLoadConfig(unittest.TestCase):
    """Tests for load_config function covering all code paths."""

    def test_load_config_with_non_existent_file(self):
        """When config file doesn't exist, defaults should be used."""
        config = load_config(Path("/nonexistent/config.yaml"))
        self.assertIsInstance(config, LlamaConfig)
        self.assertEqual(config.temperature, 0.7)

    def test_load_config_with_valid_yaml(self):
        """YAML config values should override defaults."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump({"temperature": 0.9, "n_ctx": 4096}, f)
            f.flush()
            config = load_config(Path(f.name))
        self.assertEqual(config.temperature, 0.9)
        self.assertEqual(config.n_ctx, 4096)

    def test_load_config_yaml_error_raises_configuration_error(self):
        """Malformed YAML should raise ConfigurationError."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("{{invalid: yaml: [}")
            f.flush()
            with self.assertRaises(ConfigurationError):
                load_config(Path(f.name))

    @patch.dict(os.environ, {"LLAMA_LAUNCHER_N_CTX": "8192"})
    def test_env_var_n_ctx_override(self):
        """Environment variable LLAMA_LAUNCHER_N_CTX should override config."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump({"temperature": 0.5}, f)
            f.flush()
            config = load_config(Path(f.name))
        self.assertEqual(config.n_ctx, 8192)

    @patch.dict(os.environ, {"LLAMA_LAUNCHER_TEMPERATURE": "0.85"})
    def test_env_var_temperature_override(self):
        """Environment variable LLAMA_LAUNCHER_TEMPERATURE should override config."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump({"n_ctx": 1024}, f)
            f.flush()
            config = load_config(Path(f.name))
        self.assertEqual(config.temperature, 0.85)

    @patch.dict(os.environ, {"LLAMA_LAUNCHER_HF_TOKEN": "secret-key-123"})
    def test_env_var_hf_api_key_override(self):
        """Environment variable LLAMA_LAUNCHER_HF_TOKEN should set hf_api_key."""
        config = load_config(Path("/nonexistent/config.yaml"))
        self.assertEqual(config.hf_api_key, "secret-key-123")

    @patch.dict(os.environ, {"LLAMA_LAUNCHER_N_CTX": "not_a_number"})
    def test_env_var_invalid_type_raises_configuration_error(self):
        """Invalid env var type should raise ConfigurationError."""
        with self.assertRaises(ConfigurationError):
            load_config(Path("/nonexistent/config.yaml"))

    @patch("backend.config.parse_cli_args")
    def test_cli_arg_override_n_ctx(self, mock_parse_cli):
        """CLI argument --n_ctx should override YAML and defaults."""
        mock_parse_cli.return_value = {"n_ctx": 16384}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump({"temperature": 0.5}, f)
            f.flush()
            config = load_config(Path(f.name))
        self.assertEqual(config.n_ctx, 16384)

    @patch("backend.config.parse_cli_args")
    def test_cli_arg_override_temperature(self, mock_parse_cli):
        """CLI argument --temp maps to 'temp' key but load_config handles it as 'temperature'."""
        # The load_config function checks for key "temperature" in cli_args
        mock_parse_cli.return_value = {"temperature": 0.3}
        config = load_config(Path("/nonexistent/config.yaml"))
        self.assertEqual(config.temperature, 0.3)

    @patch("backend.config.parse_cli_args")
    def test_cli_arg_override_log_level(self, mock_parse_cli):
        """CLI argument --log-level should override defaults."""
        mock_parse_cli.return_value = {"log_level": "DEBUG"}
        config = load_config(Path("/nonexistent/config.yaml"))
        self.assertEqual(config.log_level, "DEBUG")

    @patch("backend.config.parse_cli_args")
    def test_cli_arg_invalid_type_raises_configuration_error(self, mock_parse_cli):
        """CLI arg with invalid type should raise ConfigurationError."""
        mock_parse_cli.return_value = {"n_ctx": "not_a_number"}
        with self.assertRaises(ConfigurationError):
            load_config(Path("/nonexistent/config.yaml"))


    @patch("backend.config.parse_cli_args")
    def test_generic_file_read_error_raises_configuration_error(self, mock_parse_cli):
        """Non-YAML file read errors should raise ConfigurationError."""
        mock_parse_cli.return_value = {}

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("valid: yaml")
            f.flush()

            # Patch open to raise a generic OSError
            with patch("builtins.open", side_effect=OSError("Permission denied")):
                with self.assertRaises(ConfigurationError):
                    load_config(Path(f.name))

    def test_validation_failure_raises_configuration_error(self):
        """Invalid merged config data (e.g. bad server_port) should raise ConfigurationError."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump({"server_port": 99999}, f)
            f.flush()
            with self.assertRaises(ConfigurationError):
                load_config(Path(f.name))


if __name__ == "__main__":
    unittest.main()
