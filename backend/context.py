from pathlib import Path
from typing import Any, Dict, Optional

from backend.config import LlamaConfig, load_config
from backend.llama_runner import LlamaRunner
from backend.model_manager import ModelManager
from backend.exceptions import ConfigurationError
from backend.logger import get_logger

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
