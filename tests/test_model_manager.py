# Test suite for ModelManager
import asyncio
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
from backend.config import LlamaConfig
from backend.model_manager import ModelManager
from backend.exceptions import TransientProcessError
from typing import Optional, List

class TestModelManager(unittest.TestCase):

    def setUp(self):
        # Setup a minimal config for testing
        self.mock_config = LlamaConfig(
            local_model_search_paths=[Path("/tmp/test_models")]
        )
        self.manager = ModelManager(self.mock_config)

    def test_autodetect_local_models_success(self):
        with patch('backend.model_manager.scan_local_models') as mock_scan:
            mock_scan.return_value = [
                {"id": "model_a_7b", "path": "/tmp/test_models/model_a_7b.gguf", "source": "local"}
            ]

            detected = self.manager.autodetect_local_models()

            self.assertIsInstance(detected, list)
            self.assertEqual(len(detected), 1)
            self.assertIn("path", detected[0])
            self.assertEqual(detected[0]["path"], "/tmp/test_models/model_a_7b.gguf")
            self.assertIn("source", detected[0])
            self.assertEqual(detected[0]["source"], "local")

    @patch('pathlib.Path.glob')
    @patch('pathlib.Path.exists', return_value=False)
    def test_autodetect_local_models_empty(self, mock_exists, mock_glob):
        # Setup mock file system for empty case
        mock_glob.return_value = []

        detected = self.manager.autodetect_local_models()

        self.assertEqual(len(detected), 0)

    @patch('backend.model_manager.HfApi')
    def test_search_huggingface_success(self, MockHfApi):
        # Mock the HfApi instance and the list_models method
        mock_api_instance = MockHfApi.return_value

        # Mock the result objects from the HF API
        mock_results = [
            MagicMock(
                modelId="test-model-1",
                id="test-model-1",
                description="First test model.",
                author=None,
                license=None,
                last_modified="2023-01-01T00:00:00Z",
                downloads=100,
                tags=["test", "hf"]
            ),
            MagicMock(
                modelId="test-model-2",
                id="test-model-2",
                description="Second test model with rich info.",
                author="UserA",
                license="apache-2.0",
                last_modified="2023-02-01T00:00:00Z",
                downloads=200,
                tags=["test", "new"]
            )
        ]

        mock_api_instance.list_models.return_value = iter(mock_results)

        manager = ModelManager(self.mock_config)
        results = asyncio.run(manager.search_huggingface("test-query", limit=2))

        self.assertEqual(len(results), 2)

        # Assert structure correctness
        self.assertEqual(results[0]["name"], "test-model-1")
        self.assertEqual(results[0]["source"], "hf")
        self.assertEqual(results[1]["author"], "UserA")
        self.assertIn("tags", results[1])

    @patch('backend.model_manager.HfApi')
    @patch('asyncio.sleep', return_value=None)  # Mock sleep to speed up test
    def test_search_huggingface_rate_limit_and_backoff(self, mock_sleep, MockHfApi):
        # Mock the HfApi instance and the list_models method
        mock_api_instance = MockHfApi.return_value

        # Setup the side effect: Fail twice with TransientProcessError, succeed on third attempt
        transient_error = TransientProcessError("API Rate Limit Exceeded")
        success_result = [
            MagicMock(
                modelId="final-model",
                id="final-model",
                description="Model found on third try.",
                author=None,
                license=None,
                last_modified="2023-03-01T00:00:00Z",
                downloads=50,
                tags=["success"]
            )
        ]

        call_count = [0]
        def side_effect(*a, **kw):
            call_count[0] += 1
            if call_count[0] <= 2:
                raise transient_error
            return iter(success_result)

        mock_api_instance.list_models.side_effect = side_effect

        manager = ModelManager(self.mock_config)

        # Run the async method via asyncio.run()
        results = asyncio.run(manager.search_huggingface("backoff-query", limit=1))

        # Assertions
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "final-model")

        # Assert backoff logic was called (sleep called twice)
        self.assertEqual(mock_sleep.call_count, 2)

    @patch('backend.model_manager.HfApi')
    @patch('asyncio.sleep', return_value=None)  # Mock sleep to speed up test
    def test_search_huggingface_max_retries_failure(self, mock_sleep, MockHfApi):
        # Mock the HfApi instance and the list_models method
        mock_api_instance = MockHfApi.return_value

        # Setup the side effect: Fail 5 times (max retries)
        transient_error = TransientProcessError("API Rate Limit Exceeded")

        def fake_list_models(*a, **kw):
            raise transient_error

        mock_api_instance.list_models.side_effect = fake_list_models

        manager = ModelManager(self.mock_config)

        # Assert that the function raises TransientProcessError after max retries
        with self.assertRaisesRegex(TransientProcessError, "Hugging Face search failed after multiple retries"):
            asyncio.run(manager.search_huggingface("fail-query", limit=1))

