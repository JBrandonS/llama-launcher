# backend/ini_writer.py
"""Write and load llama.cpp server configurations in INI format."""

import configparser
from pathlib import Path
from typing import Any, Dict, List


def load_server_configs(ini_dir: str) -> List[Dict[str, Any]]:
    """Load server configurations from all .ini files in a directory.

    Returns a list of dicts with keys: name, model, port, context_size,
    temperature, top_k, top_p, threads, n_predict, gpu_layers.
    Uses sensible defaults for any missing values.
    """
    configs: List[Dict[str, Any]] = []
    ini_path = Path(ini_dir)

    if not ini_path.exists() or not ini_path.is_dir():
        return configs

    for ini_file in sorted(ini_path.glob("*.ini")):
        try:
            config = configparser.ConfigParser()
            config.optionxform = str  # preserve case
            config.read_string(ini_file.read_text(encoding="utf-8"))
        except Exception:
            # Skip files that cannot be parsed as INI
            continue

        # Skip empty configs (no meaningful sections)
        has_model = config.has_section("model") and config.has_option("model", "path")
        has_server = config.has_section("server") and config.has_option("server", "port")
        if not has_model or not has_server:
            continue

        def _get(section: str, key: str, fallback: str) -> str:
            try:
                return config.get(section, key, fallback=fallback).strip()
            except Exception:
                return fallback

        def _get_int(section: str, key: str, fallback: int) -> int:
            try:
                val = config.get(section, key, fallback=str(fallback)).strip()
                return int(val)
            except (ValueError, configparser.NoSectionError, configparser.NoOptionError):
                return fallback

        def _get_float(section: str, key: str, fallback: float) -> float:
            try:
                val = config.get(section, key, fallback=str(fallback)).strip()
                return float(val)
            except (ValueError, configparser.NoSectionError, configparser.NoOptionError):
                return fallback

        model_path = _get("model", "path", "")
        port = _get_int("server", "port", 12345)
        name = _get("server", "name", "") or Path(model_path).stem if model_path else f"server-{port}"

        config_dict: Dict[str, Any] = {
            "name": name,
            "model": model_path,
            "port": port,
            "context_size": _get_int("model", "ctx-size", 2048),
            "temperature": _get_float("sampling", "temp", 0.7),
            "top_k": _get_int("sampling", "top-k", 40),
            "top_p": _get_float("sampling", "top-p", 0.95),
            "threads": _get_int("model", "threads", 8),
            "n_predict": _get_int("model", "n-predict", 512),
            "gpu_layers": _get_int("model", "gpu-layers", -1),
        }

        configs.append(config_dict)

    return configs


def write_server_ini(
    model_path: str,
    host: str = "127.0.0.1",
    port: int = 12345,
    n_ctx: int = 2048,
    n_gpu_layers: int = -1,
    threads: int = 8,
    temp: float = 0.7,
    top_k: int = 40,
    top_p: float = 0.95,
    n_predict: int = 512,
    embedding: bool = False,
    rope_scaling: str = "none",
    **extra: dict[str, str],
) -> str:
    """Generate a llama.cpp server .ini configuration string."""
    lines = [
        "[server]",
        f"host = {host}",
        f"port = {port}",
        "",
        "[model]",
        f"path = {model_path}",
        f"ctx-size = {n_ctx}",
        f"gpu-layers = {n_gpu_layers}",
        f"threads = {threads}",
        f"embedding = {str(embedding).lower()}",
        "",
        "[sampling]",
        f"temp = {temp}",
        f"top-k = {top_k}",
        f"top-p = {top_p}",
        f"repeat-penalty = 1.1",
        "",
        "[advanced]",
        f"rope-scaling = {rope_scaling}",
    ]

    # Pass through any extra fields as key = value lines
    for key, value in extra.items():
        if value is not None and str(value).strip():
            lines.append(f"{key} = {value}")

    return "\n".join(lines) + "\n"
