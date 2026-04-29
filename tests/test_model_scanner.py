# tests/test_model_scanner.py
import unittest
import os
import tempfile
from pathlib import Path
from backend.model_manager import scan_local_models, ModelRegistry
from typing import Optional, List

class TestModelScanner(unittest.TestCase):
    """Tests the scan_local_models function."""

    def test_scan_local_models_default_returns_list(self):
        """Tests that scan_local_models returns a list."""
        registry = ModelRegistry()
        result = scan_local_models(registry)
        self.assertIsInstance(result, list)

    def test_scan_local_models_with_custom_path(self):
        """Tests scanning a custom directory with GGUF files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create fake GGUF files
            Path(tmpdir, "test-model-1.gguf").touch()
            Path(tmpdir, "test-model-2.gguf").touch()
            Path(tmpdir, "readme.txt").write_text("not a model")

            registry = ModelRegistry()
            result = scan_local_models(registry, [tmpdir])

            self.assertEqual(len(result), 2)
            self.assertTrue(all("path" in m and m["source"] == "local" for m in result))
            self.assertTrue(all(str(m["path"]).endswith(".gguf") for m in result))

    def test_scan_local_models_json_serializable(self):
        """Tests JSON serialization."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Path(tmpdir, "model.gguf").touch()
            registry = ModelRegistry()
            result = scan_local_models(registry, [tmpdir])

            import json
            json_output = json.dumps(result)
            self.assertIsInstance(json_output, str)

    def test_scan_local_models_gguf_filter(self):
        """Tests that non-GGUF files are filtered."""
        with tempfile.TemporaryDirectory() as tmpdir:
            Path(tmpdir, "model.gguf").touch()
            Path(tmpdir, "model.bin").touch()

            registry = ModelRegistry()
            result = scan_local_models(registry, [tmpdir])

            self.assertEqual(len(result), 1)
            self.assertTrue(str(result[0]["path"]).endswith(".gguf"))

    def test_scan_local_models_non_existent_path(self):
        """Tests graceful handling of non-existent paths."""
        registry = ModelRegistry()
        result = scan_local_models(registry, ["/non/existent/path"])
        self.assertEqual(result, [])

if __name__ == '__main__':
    unittest.main()