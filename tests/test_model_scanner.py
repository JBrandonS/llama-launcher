# tests/test_model_scanner.py
import unittest
import os
import tempfile
from pathlib import Path
from llama_launcher.model_manager import scan_local_models

class TestModelScanner(unittest.TestCase):
    """Tests the scan_local_models function."""

    def test_scan_local_models_default_returns_list(self):
        """Tests that scan_local_models returns a list."""
        result = scan_local_models()
        self.assertIsInstance(result, list)

    def test_scan_local_models_with_custom_path(self):
        """Tests scanning a custom directory with GGUF files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create fake GGUF files
            Path(tmpdir, "test-model-1.gguf").touch()
            Path(tmpdir, "test-model-2.gguf").touch()
            Path(tmpdir, "readme.txt").write_text("not a model")
            
            result = scan_local_models([tmpdir])
            
            self.assertEqual(len(result), 2)
            self.assertTrue(all(m["name"].endswith(".gguf") for m in result)))
            self.assertTrue(all(m["source"] == "local" for m in result)))
            
    def test_scan_local_models_json_serializable(self):
        """Tests JSON serialization."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Path(tmpdir, "model.gguf").touch()
            result = scan_local_models([tmpdir])
            
            import json
            json_output = json.dumps(result)
            self.assertIsInstance(json_output, str)

    def test_scan_local_models_gguf_filter(self):
        """Tests that non-GGUF files are filtered."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Path(tmpdir, "model.gguf").touch()
            Path(tmpdir, "model.bin").touch()
            
            result = scan_local_models([tmpdir])
            
            self.assertEqual(len(result), 1)
            self.assertTrue(result[0]["name"].endswith(".gguf"))

    def test_scan_local_models_non_existent_path(self):
        """Tests graceful handling of non-existent paths."""
        result = scan_local_models(["/non/existent/path"])
        self.assertEqual(result, [])

if __name__ == '__main__':
    unittest.main()