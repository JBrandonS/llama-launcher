# llama_launcher/config_store.py
import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List


CONFIGS_DIR = Path.home() / '.llama_launcher' / 'configs'


class ConfigItem:
    def __init__(self, name: str, data: Dict[str, Any]):
        self.name = name
        self.config = data

    def get(self, key: str, default=None):
        return self.config.get(key, default)

    @property
    def model_path(self):
        return self.config.get('default_model_path')

    @property
    def n_gpu_layers(self):
        return self.config.get('n_gpu_layers', -1)

    @property
    def threads(self):
        return self.config.get('threads', 4)


class ConfigStore:
    def __init__(self):
        CONFIGS_DIR.mkdir(parents=True, exist_ok=True)

    def _path(self, name: str) -> Path:
        return CONFIGS_DIR / f'{name}.yaml'

    def save(self, name: str, data: Dict[str, Any], force: bool = False) -> Path:
        if not name:
            raise ValueError("Config name is required")
        if isinstance(data.get('default_model_path'), str):
            pass
        path = self._path(name)
        if path.exists() and not force:
            raise FileExistsError(f"Config '{name}' already exists. Use --force to overwrite.")
        with open(path, 'w') as f:
            yaml.dump(data, f, default_flow_style=False)
        return path

    def load(self, name: str = 'default') -> ConfigItem:
        path = self._path(name)
        if not path.exists():
            raise FileNotFoundError(f"Config '{name}' not found at {path}")
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return ConfigItem(name, data)

    def list_configs(self) -> List[ConfigItem]:
        items = []
        if not CONFIGS_DIR.exists():
            return items
        for path in CONFIGS_DIR.glob('*.yaml'):
            try:
                with open(path) as f:
                    data = yaml.safe_load(f) or {}
                name = path.stem
                items.append(ConfigItem(name, data))
            except (yaml.YAMLError, OSError):
                continue
        return items

    def delete(self, name: str) -> bool:
        path = self._path(name)
        if path.exists():
            path.unlink()
            return True
        return False

    def set_value(self, name: str, key: str, value: Any) -> ConfigItem:
        try:
            config = self.load(name)
        except FileNotFoundError:
            config = ConfigItem(name, {})
        data = dict(config.config)
        data[key] = value
        self.save(name, data, force=True)
        return ConfigItem(name, data)
