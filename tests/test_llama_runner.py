# Test suite for LlamaRunner
import unittest
from unittest.mock import patch, MagicMock
import subprocess
from typing import List, Dict
from llama_launcher.config import LlamaConfig
from llama_launcher.llama_runner import LlamaRunner

class TestLlamaRunner(unittest.TestCase):
    """Tests the original run_model implementation."""
    
    def setUp(self):
        self.mock_config = LlamaConfig()
        self.runner = LlamaRunner(self.mock_config)
        self.test_model_path = "/path/to/model.gguf"

    @patch('llama_launcher.llama_runner.subprocess.Popen')
    def test_generate_command_structure(self, mock_popen):
        # Test command generation with default options
        command = self.runner.generate_command(self.test_model_path)

        self.assertIsInstance(command[0], str)
        self.assertEqual(command[1], "-m")
        self.assertEqual(command[2], self.test_model_path)
        self.assertTrue(len(command) > 2)

    @patch('llama_launcher.llama_runner.subprocess.Popen')
    def test_run_model_success(self, mock_popen):
        # Test successful process startup
        mock_proc = MagicMock()
        mock_popen.return_value = mock_proc

        process = self.runner.run_model(self.test_model_path)

        self.assertIsInstance(process, MagicMock)
        mock_popen.assert_called_once()

    @patch('llama_launcher.llama_runner.subprocess.Popen', side_effect=RuntimeError("Exec not found"))
    def test_run_model_failure(self, mock_popen):
        # Test failure due to executable not found
        with self.assertRaisesRegex(RuntimeError, "Failed to start llama.cpp process"):
            self.runner.run_model(self.test_model_path)

class TestLlamaRunnerMock(unittest.TestCase):
    """Tests the run_model_mock interface for input validation and deterministic output."""
    
    def setUp(self):
        # Initialize a mock runner instance for testing
        self.runner = LlamaRunner(config=MagicMock())

    def test_run_model_mock_valid_input_returns_success(self):
        """Tests the happy path: valid inputs result in a successful, deterministic mock output."""
        model_path = "/mock/models/test.gguf"
        prompt = "What is the capital of France?"
        options = {"temp": 0.7, "n_ctx": 2048}
        
        result = self.runner.run_model_mock(model_path, prompt, options)
        
        # Assertions against the expected contract
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["model_path"], model_path)
        self.assertEqual(result["prompt"], prompt)
        self.assertEqual(result["options"], options)
        self.assertIn("Mock generated response", result["output"])
        self.assertEqual(result["tokens"], 128)

    def test_run_model_mock_valid_input_no_options(self):
        """Tests the happy path when no custom options are provided."""
        model_path = "/mock/models/test.gguf"
        prompt = "A short test prompt."
        
        result = self.runner.run_model_mock(model_path, prompt)
        
        # Assertions against the expected contract
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["options"], {}) # Should default to empty dict

    def test_run_model_mock_invalid_model_path_raises_value_error(self):
        """Tests validation failure when model_path is missing."""
        prompt = "Some prompt"
        with self.assertRaisesRegex(ValueError, "Model path must be provided for mock execution."):
            self.runner.run_model_mock(model_path="", prompt=prompt)

    def test_run_model_mock_valid_input_returns_success(self):
        """Tests the happy path: valid inputs result in a successful, deterministic mock output."""
        model_path = "/mock/models/test.gguf"
        prompt = "What is the capital of France?"
        options = {"temp": 0.7, "n_ctx": 2048}
        
        result = self.runner.run_model_mock(model_path, prompt, options)
        
        # Assertions against the expected contract
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["model_path"], model_path)
        self.assertEqual(result["prompt"], prompt)
        self.assertEqual(result["options"], options)
        self.assertIn("Mock generated response", result["output"])
        self.assertEqual(result["tokens"], 128)

    def test_run_model_mock_valid_input_no_options(self):
        """Tests the happy path when no custom options are provided."""
        model_path = "/mock/models/test.gguf"
        prompt = "A short test prompt."
        
        result = self.runner.run_model_mock(model_path, prompt)
        
        # Assertions against the expected contract
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["options"], {}) # Should default to empty dict

    def test_run_model_mock_invalid_model_path_raises_value_error(self):
        """Tests validation failure when model_path is missing."""
        prompt = "Some prompt"
        with self.assertRaisesRegex(ValueError, "Model path must be provided for mock execution."):
            self.runner.run_model_mock(model_path="", prompt=prompt)

    def test_run_model_mock_invalid_prompt_raises_value_error(self):
        """Tests validation failure when prompt is missing."""
        model_path = "/mock/models/test.gguf"
        with self.assertRaisesRegex(ValueError, "Prompt must be provided for mock execution."):
            self.runner.run_model_mock(model_path=model_path, prompt="")

    def test_run_model_mock_with_empty_options_dict_succeeds(self):
        """Tests that an empty options dictionary is handled correctly."""
        model_path = "/mock/models/test.gguf"
        prompt = "Empty options test."
        
        result = self.runner.run_model_mock(model_path, prompt, options={})
        
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["options"], {})

class TestCLIIntegration(unittest.TestCase):
    """Integration tests verifying the CLI correctly invokes the run_model_mock method."""
    
    def test_cli_run_model_outputs_json(self):
        """Tests that invoking the runner mock produces JSON-serializable output."""
        mock_config = MagicMock()
        runner = LlamaRunner(mock_config)
        
        result = runner.run_model_mock("/path/to/model.gguf", "Test prompt", {"temp": 0.5})
        
        import json
        # Verify the output is JSON-serializable
        json_output = json.dumps(result)
        self.assertIsInstance(json_output, str)
        # Verify key fields are present
        parsed = json.loads(json_output)
        self.assertEqual(parsed["status"], "success")


if __name__ == '__main__':
    unittest.main()