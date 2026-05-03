"""Central constants for llama-launcher paths and configuration."""

from pathlib import Path

LLAMA_LAUNCHER_CACHE = Path.home() / ".cache" / "llama-launcher"

PID_DIR = LLAMA_LAUNCHER_CACHE / "pids"
LOG_DIR = LLAMA_LAUNCHER_CACHE / "logs"
CONFIGS_DIR = LLAMA_LAUNCHER_CACHE / "configs"
SERVICE_DIR = LLAMA_LAUNCHER_CACHE / "services"
MODELS_DIR = LLAMA_LAUNCHER_CACHE / "models"
DEFAULT_MODEL_PATH = LLAMA_LAUNCHER_CACHE / "default_model.gguf"


def ensure_directories() -> None:
    """Create all required cache directories on startup."""
    for d in (PID_DIR, LOG_DIR, CONFIGS_DIR, SERVICE_DIR, MODELS_DIR):
        d.mkdir(parents=True, exist_ok=True)
