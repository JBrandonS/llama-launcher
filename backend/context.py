from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import LlamaConfig, load_config
from backend.exceptions import ConfigurationError
from backend.llama_runner import LlamaRunner
from backend.logger import get_logger
from backend.model_manager import ModelManager

LOGGER = get_logger(__name__)


class Context:
    """
    Central context object for the llama-launcher CLI.
    Holds loaded configuration, model manager, and runner instances.
    """
    def __init__(self, config_path: Optional[str] = "config.yaml"):
        """
        Initializes the context by loading the configuration and discovering local models.
        """
        resolved = config_path or "config.yaml"
        self.config: LlamaConfig = self._load_config(resolved)
        self.model_manager = ModelManager(self.config)

    def _load_config(self, config_path: str) -> LlamaConfig:
        """
        Loads the configuration object from a YAML file.
        Raises ConfigurationError if loading fails.
        """
        try:
            LOGGER.info(f"Loading configuration from {config_path}...")
            return load_config(Path(config_path))
        except Exception as e:
            raise ConfigurationError(f"Failed to load configuration from {config_path}: {e}")

    def execute(
        self,
        model_name: str,
        prompt: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> Any:
        """
        Executes a task using the LlamaRunner with provided parameters.
        Creates a fresh runner instance for each call.
        Resolves the model name via ModelManager.autodetect_local_models().
        """
        LOGGER.info(f"Executing run command for model: {model_name}")

        runner = LlamaRunner(config=self.config)

        discovered = self.model_manager.autodetect_local_models()
        model_path = self._resolve_model(model_name, discovered)
        if not model_path:
            raise ConfigurationError(
                f"Could not resolve model '{model_name}'. Ensure the model exists in search paths or provide an absolute path."
            )

        custom_options: Dict[str, Any] = {}
        if temperature is not None:
            custom_options["temp"] = temperature

        result = runner.run_model_sync(str(model_path), prompt or "", custom_options)
        LOGGER.info(f"Finished execution for model: {model_name}")
        return result

    def _resolve_model(self, name: str, discovered: list[Dict[str, Any]]) -> Optional[Path]:
        for model in discovered:
            if model.get("id") == name:
                return model["path"]
        candidate = Path(name)
        if candidate.is_file():
            return candidate.resolve()
        return None


def get_context() -> Context:
    return Context()


# ── ServerContext ──────────────────────────────────────────────────────

_MAX_METRICS_HISTORY = 500


class ServerContext:
    """
    Owning seam for all server-side business state.

    Replaces the module-level globals in api_server.py (_config,
    _process_manager, _model_manager, _runner, _metrics_history,
    _gpu_initialized).  Every API handler receives a ServerContext
    instance and accesses state through it instead of reaching for
    module globals.

    The class lazily instantiates ProcessManager, ModelManager, and
    LlamaRunner on first access so that the server can start without
    blocking on model scanning.
    """

    def __init__(
        self,
        config: LlamaConfig | None = None,
        config_path: str | None = None,
        process_manager: Any | None = None,
        model_manager: ModelManager | None = None,
        runner: LlamaRunner | None = None,
        metrics_history: list[dict[str, Any]] | None = None,
        metrics_history_lock: threading.Lock | None = None,
        gpu_initialized: bool = False,
    ):
        if config is None:
            if config_path is None:
                config_path = "config.yaml"
            config = load_config(Path(config_path))
        self.config: LlamaConfig = config

        self._process_manager: Any | None = process_manager
        self._model_manager: ModelManager | None = model_manager
        self._runner: LlamaRunner | None = runner
        self._metrics_history: list[dict[str, Any]] = metrics_history if metrics_history is not None else []
        self._metrics_history_lock: threading.Lock = metrics_history_lock if metrics_history_lock is not None else threading.Lock()
        self.gpu_initialized: bool = gpu_initialized

    # ── Lazy accessors ──────────────────────────────────────────────

    @property
    def process_manager(self) -> Any:
        if self._process_manager is None:
            from backend.process_manager import ProcessManager
            self._process_manager = ProcessManager(self.config)
        return self._process_manager

    @property
    def model_manager(self) -> ModelManager:
        if self._model_manager is None:
            self._model_manager = ModelManager(self.config)
        return self._model_manager

    @property
    def runner(self) -> LlamaRunner:
        if self._runner is None:
            self._runner = LlamaRunner(self.config)
        return self._runner

    # ── Metrics history ─────────────────────────────────────────────

    def append_metric(self, metric: dict[str, Any]) -> None:
        with self._metrics_history_lock:
            self._metrics_history.append(metric)
            if len(self._metrics_history) > _MAX_METRICS_HISTORY:
                self._metrics_history.pop(0)

    def get_metrics_history(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._metrics_history_lock:
            return list(self._metrics_history[-limit:])

    # ── GPU detection ──────────────────────────────────────────────

    def init_gpu_detection(self) -> None:
        """Detect active GPU backend and log it (runs once)."""
        if self.gpu_initialized:
            return
        self.gpu_initialized = True
        try:
            import backend.gpu_detector as gpu_detector
            gpus = gpu_detector.detect_gpu()
            backend = gpu_detector.get_active_backend()
            if backend:
                LOGGER.info("GPU backend active: %s (%d device(s))", backend, len(gpus))
            else:
                LOGGER.info("No GPU hardware or drivers detected — running in CPU-only mode")
        except Exception:
            LOGGER.debug("GPU detection logging failed", exc_info=True)

    # ── Utility helpers ─────────────────────────────────────────────

    @staticmethod
    def iso_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def human_size(nbytes: int | float) -> str:
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if abs(nbytes) < 1024.0:
                return f"{nbytes:.1f} {unit}"
            nbytes /= 1024.0
        return f"{nbytes:.1f} PB"


def get_server_context(
    config: LlamaConfig | None = None,
    config_path: str | None = None,
) -> ServerContext:
    """Convenience factory for the common case (no injected deps)."""
    return ServerContext(config=config, config_path=config_path)


# ── FakeServerContext ────────────────────────────────────────────────


class FakeServerContext:
    """Minimal ServerContext replacement for tests.

    Provides the same public interface as ServerContext but uses
    injected or default values instead of lazy instantiation.
    """

    def __init__(
        self,
        config: LlamaConfig | None = None,
        process_manager: Any | None = None,
        model_manager: ModelManager | None = None,
        runner: LlamaRunner | None = None,
        metrics_history: list[dict[str, Any]] | None = None,
        metrics_history_lock: threading.Lock | None = None,
        gpu_initialized: bool = False,
    ):
        self.config: LlamaConfig = config or LlamaConfig()
        self._process_manager = process_manager
        self._model_manager = model_manager
        self._runner = runner
        self._metrics_history: list[dict[str, Any]] = metrics_history if metrics_history is not None else []
        self._metrics_history_lock: threading.Lock = metrics_history_lock if metrics_history_lock is not None else threading.Lock()
        self.gpu_initialized: bool = gpu_initialized

    @property
    def process_manager(self) -> Any:
        return self._process_manager

    @property
    def model_manager(self) -> ModelManager:
        assert self._model_manager is not None
        return self._model_manager

    @property
    def runner(self) -> LlamaRunner:
        assert self._runner is not None
        return self._runner

    def append_metric(self, metric: dict[str, Any]) -> None:
        with self._metrics_history_lock:
            self._metrics_history.append(metric)
            if len(self._metrics_history) > _MAX_METRICS_HISTORY:
                self._metrics_history.pop(0)

    def get_metrics_history(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._metrics_history_lock:
            return list(self._metrics_history[-limit:])

    def init_gpu_detection(self) -> None:
        self.gpu_initialized = True

  
    @staticmethod
    def iso_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def human_size(nbytes: int | float) -> str:
        return ServerContext.human_size(nbytes)

    @staticmethod
    def make_json_handler(super_class: Any):
        """Return a JSON mixin (no-op for FakeServerContext tests)."""
        return super_class
