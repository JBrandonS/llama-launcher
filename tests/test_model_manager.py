# Test suite for ModelManager

import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
from llama_launcher.config import LlamaConfig
from llama_launcher.model_manager import ModelManager

class TestModelManager(unittest.TestCase):
    
    def setUp(self):
        # Setup a minimal config for testing
        self.mock_config = LlamaConfig(
            local_model_search_paths=[Path("/tmp/test_models")]
        )
        self.manager = ModelManager(self.mock_config)

    @patch('pathlib.Path.glob')
    @patch('pathlib.Path.exists', return_value=True)
    @patch('pathlib.Path.iterdir')
    def test_autodetect_local_models_success(self, mock_iterdir, mock_exists, mock_glob):
        # Setup mock file system for success case
        mock_glob.return_value = [Path("/tmp/test_models/model_a_7b.gguf")]
        mock_iterdir.return_value = []  # No subdirectories

        detected = self.manager.autodetect_local_models()

        self.assertEqual(len(detected), 1)
        self.assertIn("model_a_7b", detected)
        self.assertIn("path", detected["model_a_7b"])
        self.assertEqual(detected["model_a_7b"]["path"], Path("/tmp/test_models/model_a_7b.gguf"))

    @patch('pathlib.Path.glob')
    @patch('pathlib.Path.exists', return_value=False)
    def test_autodetect_local_models_empty(self, mock_exists, mock_glob):
        # Setup mock file system for empty case
        mock_glob.return_value = []
        
        detected = self.manager.autodetect_local_models()
        
        self.assertEqual(len(detected), 0)

    @patch('huggingface_hub.HfApi.hf_hub_download')
    @patch('pathlib.Path.exists', return_value=True)
    @patch('pathlib.Path.glob')
    @patch('pathlib.Path.iterdir')
    def test_download_model_and_autodetect(self, mock_iterdir, mock_glob, mock_exists, mock_download):
        # Setup mock local environment
        mock_exists.return_value = True
        mock_iterdir.return_value = []  # No subdirectories

        # Setup the mock glob to return the file that the download function creates
        downloaded_path = Path("/tmp/qwen3_downloaded/qwen3-1.gguf")
        mock_glob.return_value = [downloaded_path]

        # Setup mock download to return the specific path
        mock_download.return_value = downloaded_path

        # Test download
        manager = ModelManager(self.mock_config)
        downloaded_model_path = manager.download_model("qwen3", Path("/tmp/qwen3_downloaded"))

        self.assertEqual(downloaded_model_path, downloaded_path)
        mock_download.assert_called_once()

        # Test auto-detection after download
        detected = manager.autodetect_local_models()
        self.assertIn("qwen3-1", detected)
        self.assertEqual(detected["qwen3-1"]["path"], downloaded_path)