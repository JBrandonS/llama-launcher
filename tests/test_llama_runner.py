# Test suite for LlamaRunner

import unittest
from unittest.mock import patch, MagicMock
import subprocess
from typing import List, Dict # <--- FIX: Import generic types
from llama_launcher.config import LlamaConfig
from llama_launcher.llama_runner import LlamaRunner

class TestLlamaRunner(unittest.TestCase):
    
    def setUp(self):
        self.mock_config = LlamaConfig()
        self.runner = LlamaRunner(self.mock_config)
        self.test_model_path = "/path/to/model.gguf"

    @patch('llama_launcher.llama_runner.subprocess.Popen')
    def test_generate_command_structure(self, mock_popen):
        # Test command generation with default options
        command = self.runner.generate_command(self.test_model_path)
        
        self.assertTrue(command[0].endswith("main")) # Check for executable name
        self.assertTrue("-m" in command) # Check for model path flag
        self.assertTrue("--n-ctx" in command) # Check for context flag
        self.assertTrue(len(command) > 2) # Ensure multiple args exist

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
        with self.assertRaisesRegex(RuntimeError, "Llama.cpp executable not found"):
            self.runner.run_model(self.test_model_path)
    @patch('llama_launcher.llama_runner.subprocess.Popen')
    def test_generate_command_structure(self, mock_popen):
        # Test command generation with default options
        command = self.runner.generate_command(self.test_model_path)
        
        self.assertTrue(command[0].endswith("main")) # Check for executable name
        self.assertTrue("-m" in command) # Check for model path flag
        self.assertTrue("--n-ctx" in command) # Check for context flag
        self.assertTrue(len(command) > 2) # Ensure multiple args exist

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
        with self.assertRaisesRegex(RuntimeError, "Llama.cpp executable not found"):
            self.runner.run_model(self.test_model_path)

if __name__ == '__main__':
    unittest.main()