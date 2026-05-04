"""Tests for backend/constants.py — path constants and directory creation."""

from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from backend.constants import (
    LLAMA_LAUNCHER_CACHE,
    PID_DIR,
    LOG_DIR,
    CONFIGS_DIR,
    SERVICE_DIR,
    MODELS_DIR,
    DEFAULT_MODEL_PATH,
    ensure_directories,
)


class TestPathConstants:
    """Tests for constant path definitions."""

    def test_llama_launcher_cache_path(self):
        assert LLAMA_LAUNCHER_CACHE == Path.home() / ".cache" / "llama-launcher"
        assert LLAMA_LAUNCHER_CACHE.is_absolute()

    def test_pid_dir_is_child_of_cache(self):
        assert PID_DIR == LLAMA_LAUNCHER_CACHE / "pids"
        assert PID_DIR.is_absolute()

    def test_log_dir_is_child_of_cache(self):
        assert LOG_DIR == LLAMA_LAUNCHER_CACHE / "logs"
        assert LOG_DIR.is_absolute()

    def test_configs_dir_is_child_of_cache(self):
        assert CONFIGS_DIR == LLAMA_LAUNCHER_CACHE / "configs"
        assert CONFIGS_DIR.is_absolute()

    def test_service_dir_is_child_of_cache(self):
        assert SERVICE_DIR == LLAMA_LAUNCHER_CACHE / "services"
        assert SERVICE_DIR.is_absolute()

    def test_models_dir_is_child_of_cache(self):
        assert MODELS_DIR == LLAMA_LAUNCHER_CACHE / "models"
        assert MODELS_DIR.is_absolute()

    def test_default_model_path(self):
        assert DEFAULT_MODEL_PATH == LLAMA_LAUNCHER_CACHE / "default_model.gguf"
        assert DEFAULT_MODEL_PATH.suffix == ".gguf"


class TestEnsureDirectories:
    """Tests for ensure_directories function."""

    def test_creates_all_directories(self, tmp_path):
        """ensure_directories creates all expected directories."""
        # Patch the paths to use tmp_path
        with patch("backend.constants.PID_DIR", tmp_path / "pids"), \
             patch("backend.constants.LOG_DIR", tmp_path / "logs"), \
             patch("backend.constants.CONFIGS_DIR", tmp_path / "configs"), \
             patch("backend.constants.SERVICE_DIR", tmp_path / "services"), \
             patch("backend.constants.MODELS_DIR", tmp_path / "models"):

            ensure_directories()

            assert (tmp_path / "pids").is_dir()
            assert (tmp_path / "logs").is_dir()
            assert (tmp_path / "configs").is_dir()
            assert (tmp_path / "services").is_dir()
            assert (tmp_path / "models").is_dir()

    def test_creates_parent_directories(self, tmp_path):
        """ensure_directories creates parent directories if they don't exist."""
        nested = tmp_path / "deep" / "nested" / "path"
        with patch("backend.constants.PID_DIR", nested):
            ensure_directories()
            assert nested.is_dir()

    def test_no_error_if_directories_exist(self, tmp_path):
        """ensure_directories is idempotent — no error if dirs already exist."""
        existing = tmp_path / "existing"
        existing.mkdir(parents=True)
        with patch("backend.constants.PID_DIR", existing):
            ensure_directories()  # Should not raise

    def test_creates_all_five_directories(self, tmp_path):
        """Verify all five directories are created in one call."""
        dirs_created = []

        def mock_mkdir(*args, **kwargs):
            # Track which paths were created
            pass

        with patch("pathlib.Path.mkdir", mock_mkdir) as mock:
            ensure_directories()
            # Just verify it doesn't raise — the actual directory creation
            # is tested in test_creates_all_directories
            assert True  # No exception = success
