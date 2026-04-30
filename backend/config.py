import argparse
import os
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Dict, List, Any, Optional
from .logger import get_logger
from .exceptions import ConfigurationError
LOGGER = get_logger(__name__)


def _expand_path(value: Any) -> Path:
    if isinstance(value, Path):
        return value.expanduser()
    if isinstance(value, str):
        return Path(os.path.expanduser(value))
    raise ValueError(f"Expected Path or str, got {type(value).__name__}")


class LlamaConfig(BaseModel):
    default_model_path: Path = Field(
        default=Path(os.path.expanduser("~/.cache/llama-launcher/default_model.gguf"))
    )
    working_directory: Path = Field(
        default=Path(os.path.expanduser("~/.cache/llama-launcher/models"))
    )
    local_model_search_paths: List[Path] = Field(
        default_factory=lambda: [
            Path(os.path.expanduser("~/.cache/llama.cpp/models")),
            Path(os.path.expanduser("~/.cache/huggingface/hub")),
        ]
    )
    hf_api_key: Optional[str] = Field(default=None)
    server_port: int = Field(default=12345, ge=1, le=65535)

    n_ctx: int = Field(default=2048)
    n_gpu_layers: int = Field(default=-1)
    temperature: float = Field(default=0.7)
    top_k: int = Field(default=40)
    top_p: float = Field(default=0.9)
    n_predict: int = Field(default=512)
    threads: int = Field(default=8)
    log_level: str = Field(default="INFO")

    model_config = ConfigDict(arbitrary_types_allowed=True)

    @model_validator(mode="before")
    @classmethod
    def expand_all_paths(cls, data):
        if isinstance(data, dict):
            for field_name in ("default_model_path", "working_directory"):
                if field_name in data:
                    data[field_name] = _expand_path(data[field_name])
            if "local_model_search_paths" in data and isinstance(data["local_model_search_paths"], list):
                data["local_model_search_paths"] = [_expand_path(p) for p in data["local_model_search_paths"]]
        return data

    @model_validator(mode="after")
    def clamp_n_predict(self):
        """Clamp n_predict to llama.cpp valid range: -1 (unlimited) or 1..4096."""
        v = self.n_predict
        if v == -1:
            return self
        if v < 1:
            LOGGER.warning(f"n_predict {v} < 1, clamping to 1")
            self.n_predict = 1
        elif v > 4096:
            LOGGER.warning(f"n_predict {v} > 4096, clamping to 4096")
            self.n_predict = 4096
        return self


def parse_cli_args() -> Dict[str, Any]:
    parser = argparse.ArgumentParser(description="Llama Launcher Configuration Parser")
    parser.add_argument("--model", type=str, help="Path to a specific model file (Overrides all).")
    parser.add_argument("--temp", type=float, help="Sampling temperature.")
    parser.add_argument("--n_ctx", type=int, help="Context window size.")
    parser.add_argument("--log-level", type=str, choices=["DEBUG", "INFO", "WARNING", "ERROR"], help="Set the logging level.")
    args, _ = parser.parse_known_args()
    return {k: v for k, v in vars(args).items() if v is not None}


def load_config(config_path: Path = Path("config.yaml")) -> LlamaConfig:
    cli_args = parse_cli_args()
    config = LlamaConfig()

    yaml_config = {}
    try:
        if config_path.exists():
            with open(config_path, "r") as f:
                yaml_config = yaml.safe_load(f) or {}
            LOGGER.info(f"Configuration successfully loaded from YAML file: {config_path}")
        else:
            LOGGER.warning(f"Configuration file not found at {config_path}. Using defaults/env vars.")
    except yaml.YAMLError as e:
        LOGGER.error(f"Error parsing YAML config from {config_path}: {e}", extra_data={"config_path": str(config_path)})
        raise ConfigurationError(f"YAML configuration file is corrupted: {e}")
    except Exception as e:
        LOGGER.error(f"Unexpected error reading config file: {e}", extra_data={"config_path": str(config_path)})
        raise ConfigurationError(f"Unexpected error reading config file: {e}")

    merged_config_data = config.model_dump()
    merged_config_data.update(yaml_config)

    env_vars = {
        "n_ctx": os.environ.get("LLAMA_LAUNCHER_N_CTX"),
        "temperature": os.environ.get("LLAMA_LAUNCHER_TEMPERATURE"),
        "hf_api_key": os.environ.get("LLAMA_LAUNCHER_HF_TOKEN"),
    }
    for key, env_value in env_vars.items():
        if env_value is not None:
            try:
                if key in ("n_ctx",):
                    merged_config_data[key] = int(env_value)
                elif key in ("temperature", "top_p"):
                    merged_config_data[key] = float(env_value)
                else:
                    merged_config_data[key] = env_value
            except ValueError as e:
                LOGGER.error(f"Invalid type for environment variable {key}: {e}", extra_data={"env_value": env_value})
                raise ConfigurationError(f"Invalid type provided for environment variable {key}")

    for key, cli_value in cli_args.items():
        if cli_value is not None:
            try:
                if key in ("n_ctx",):
                    merged_config_data[key] = int(cli_value)
                elif key in ("temperature",):
                    merged_config_data[key] = float(cli_value)
                elif key in ("log_level",):
                    merged_config_data[key] = cli_value
                else:
                    merged_config_data[key] = cli_value
            except ValueError as e:
                LOGGER.error(f"Invalid type provided for CLI argument {key}: {e}", extra_data={"cli_value": cli_value})
                raise ConfigurationError(f"Invalid type provided for CLI argument {key}")

    try:
        final_config = LlamaConfig(**merged_config_data)
        return final_config
    except Exception as e:
        LOGGER.critical(f"Final configuration validation failed: {e}")
        raise ConfigurationError(f"Failed to validate configuration: {e}")


if __name__ == "__main__":
    try:
        print("--- Running Config Loader Example ---")
        config = load_config(Path("non_existent_config.yaml"))
        print("\nDefaults Loaded:")
        print(f"  Temp: {config.temperature}")
        print(f"  Log Level: {config.log_level}")
    except ConfigurationError as e:
        print(f"\nDefaults Load Failure: {e}")

    except Exception as e:
        print(f"\nFatal Error in main block: {e}")

