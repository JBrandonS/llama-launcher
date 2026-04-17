# llama_launcher/config.py

import yaml
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Dict, List

class LlamaConfig(BaseModel):
    """Defines the structure for the application configuration."""
    default_model_path: Path = Field(default=Path("~/.cache/llama-launcher/default_model.gguf"))
    working_directory: Path = Field(default=Path("~/.cache/llama-launcher/models"))
    local_model_search_paths: List[Path] = Field(default_factory=lambda: [Path("~/.cache/llama.cpp/models"), Path("~/.cache/huggingface/hub")])
    default_hf_search_query: str = "llama 7b"

    # Llama.cpp Runtime Options
    n_ctx: int = 2048
    n_gpu_layers: int = -1
    temp: float = 0.7
    top_k: int = 40
    top_p: float = 0.9
    n_predict: int = 512

    class Config:
        env_file = ".env"
        arbitrary_types_allowed = True

def load_config(config_path: Path = Path("config.yaml")) -> LlamaConfig:
    """Loads configuration from a YAML file."""
    try:
        with open(config_path, 'r') as f:
            config_data = yaml.safe_load(f)

        # Convert string paths to Path objects for Pydantic validation
        processed_data = {}
        for key, value in config_data.items():
            if isinstance(value, str) and value.startswith('~'):
                processed_data[key] = Path(value).expanduser()
            elif isinstance(value, list):
                # Handle lists of paths (like local_model_search_paths)
                processed_value = []
                for item in value:
                    if isinstance(item, str) and item.startswith('~'):
                        processed_value.append(Path(item).expanduser())
                    else:
                        processed_value.append(item)
                processed_data[key] = processed_value
            else:
                processed_data[key] = value

        return LlamaConfig(**processed_data)
    except FileNotFoundError:
        raise FileNotFoundError(f"Configuration file not found at {config_path}")
    except yaml.YAMLError as e:
        raise ValueError(f"Error parsing YAML config: {e}")

if __name__ == '__main__':
    # Simple test case
    try:
        config = load_config()
        print("Configuration loaded successfully:")
        print(f"Default Model Path: {config.default_model_path}")
    except Exception as e:
        print(f"Error: {e}")