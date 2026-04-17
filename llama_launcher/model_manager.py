from pathlib import Path
import os
from typing import List, Dict, Optional, Any
from huggingface_hub import HfApi
import click
from contextlib import asynccontextmanager
import json
import logging
from datetime import datetime
from llama_launcher.config import LlamaConfig

# Configure logging for the manager
logging.basicConfig(level=logging.INFO)


class ModelRegistry:
    """
    Robust model registry that maps model IDs to file paths.
    Supports optional metadata files for explicit model identification.
    """

    def __init__(self):
        self._models: Dict[str, Dict[str, Any]] = {}

    def register(self, model_id: str, path: Path, metadata: Optional[Dict] = None):
        self._models[model_id] = {"path": path, "metadata": metadata or {}}

    def get(self, model_id: str) -> Optional[Dict[str, Any]]:
        return self._models.get(model_id)

    def get_path(self, model_id: str) -> Optional[Path]:
        model_info = self._models.get(model_id)
        return model_info["path"] if model_info else None

    def list_all(self) -> Dict[str, Dict[str, Any]]:
        return self._models.copy()

    def clear(self):
        self._models.clear()


class ModelManager:
    """Handles detection and retrieval of local and remote models."""

    def __init__(self, config: LlamaConfig):
        self.config = config
        self.local_model_paths: List[Path] = config.local_model_search_paths
        self._semaphore = asyncio.Semaphore(4)
        self.registry = ModelRegistry()

    def autodetect_local_models(self) -> Dict[str, Dict[str, Any]]:
        """
        Scans predefined local paths for GGUF files.
        Returns a dictionary mapping model ID to model info dict.
        Supports HF cache structure: models--user--model/snapshots/<hash>/*.gguf
        """
        detected_models = {}
        logging.info("Starting local model scan...")

        for base_path in self.local_model_paths:
            # Ensure the path is absolute and exists
            abs_search_path = base_path.expanduser().resolve()
            if not abs_search_path.is_dir():
                logging.warning(
                    f"Search path not found or is not a directory: {abs_search_path}"
                )
                continue

            # Check if this is an HF cache directory (contains models--*--* subdirs)
            is_hf_cache = False
            hf_model_dirs = []
            for entry in abs_search_path.iterdir():
                if entry.is_dir() and entry.name.startswith("models--"):
                    is_hf_cache = True
                    hf_model_dirs.append(entry)

            if is_hf_cache:
                # Find all GGUF files in HF cache structure
                for model_dir in hf_model_dirs:
                    # Look in snapshots subdirectories
                    for snapshot_dir in model_dir.glob("snapshots/*/"):
                        snapshot_path = Path(snapshot_dir)
                        if snapshot_path.is_dir():
                            for gguf_file in snapshot_path.glob("*.gguf"):
                                gguf_files.append(gguf_file)
                        # Also check blobs directory for symlinks
                        blobs_dir = model_dir / "blobs"
                        if blobs_dir.exists() and blobs_dir.is_dir():
                            for gguf_file in blobs_dir.glob("*.gguf"):
                                gguf_files.append(gguf_file)
            else:
                # Flat structure or nested subdirectories
                for entry in base_path.iterdir():
                    if entry.is_dir():
                        # Check for GGUF files directly in subdir
                        for gguf_file in entry.glob("*.gguf"):
                            gguf_files.append(gguf_file)
                        # Recurse into subdirectories
                        for subentry in entry.iterdir():
                            if subentry.is_dir():
                                for gguf_file in subentry.glob("*.gguf"):
                                    gguf_files.append(gguf_file)

        # --- GGUF File Processing ---
        detected_models = {}

        for file_path in gguf_files:
            model_id = None
            metadata = None

            # Try to find companion metadata file
            for suffix in [".json", ".yaml", ".yml"]:
                metadata_path = file_path.parent / f"{file_path.stem}{suffix}"
                if metadata_path.exists():
                    try:
                        if metadata_path.suffix == ".json":
                            with open(metadata_path, "r") as f:
                                metadata = json.load(f)
                            model_id = metadata.get("id", file_path.stem)
                        else:
                            model_id = file_path.stem
                    except Exception as e:
                        logging.warning(
                            f"Failed to parse metadata at {metadata_path}: {e}"
                        )
                        model_id = file_path.stem
                    break

            # Fallback to fragile naming if no metadata found
            if model_id is None:
                model_id = file_path.stem.split("-")[0]

            # Avoid duplicates
            if model_id not in detected_models:
                detected_models[model_id] = {
                    "id": model_id,
                    "path": file_path,
                    "metadata": metadata,
                }
                self.registry.register(model_id, file_path, metadata)
                logging.info(f"  [FOUND] Model: {model_id} at {file_path.resolve()}")

        logging.info("Local model scan complete.")
        return detected_models

    def search_huggingface(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Searches Hugging Face for models matching a query.
        Returns structured metadata in JSON-serializable format.
        """
        try:
            api = HfApi()
            search_results = list(api.list_models(search=query, limit=limit))

            # Transform results into the required JSON-serializable dictionary format
            hf_models = []
            for result in search_results:
                hf_models.append(
                    {
                        "name": result.modelId,
                        "id": result.id,
                        "description": getattr(result, "description", ""),
                        "author": getattr(result, "author", None),
                        "repo_type": "model",
                        "license": getattr(result, "license", None),
                        "last_modified": getattr(result, "last_modified", None),
                        "downloads": getattr(result, "downloads", None),
                        "source": "huggingface",
                        "tags": getattr(result, "tags", []),
                    }
                )
            return hf_models
        except Exception as e:
            logging.error(f"Error during Hugging Face search: {e}")
            return []

    async def run_benchmark(self, model_paths: List[Path], runner: "LlamaRunner"):
        """
        Runs a standardized benchmark across multiple selected models concurrently.
        Uses asyncio.gather() with semaphore throttling to limit concurrent runs.
        """
        logging.info("\n--- STARTING ARENA BENCHMARK ---")

        benchmark_prompt = "Write a short, imaginative poem about a space journey, focusing on wonder and solitude."
        results = {}

        async def run_single_model(model_path: Path, index: int) -> tuple:
            """Run a single model benchmark with throttling."""
            async with self._semaphore:
                model_name = Path(model_path).stem.replace("-", "_")
                logging.info(
                    f"\n--- Benchmarking Model {index + 1}/{len(model_paths)}: {model_name} ---"
                )
                try:
                    # The runner needs to be async-compatible for this concurrent approach
                    output_text = await runner.run_model_async(
                        str(model_path), benchmark_prompt
                    )
                    results[model_name] = {
                        "path": model_path,
                        "output": output_text,
                        "word_count": len(output_text.split()),
                    }
                    logging.info(
                        f"✅ {model_name} finished. Word count: {len(output_text.split())}"
                    )
                except Exception as e:
                    logging.error(f"❌ Failed to run {model_name}: {e}")
                    results[model_name] = {"error": str(e)}

        # Run all benchmarks concurrently using gather
        tasks = [run_single_model(model_paths[i], i) for i in range(len(model_paths))]
        await asyncio.gather(*tasks)

        logging.info("\n======================================")
        logging.info("🏆 Benchmark Results Summary")
        logging.info("======================================")

        for name, data in results.items():
            if "error" in data:
                logging.error(f"[{name}] ERROR: {data['error']}")
            else:
                logging.info(
                    f"\n--- Results for {name} ({len(data['output'].split())} words) ---"
                )
                logging.info(data["output"])

        logging.info("\nBenchmark complete.")

def scan_local_models(scan_paths: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Scans specified directories for GGUF models.
    
    Parameters:
        scan_paths: Optional list of directories to scan. If None, uses defaults.
    
    Returns:
        List of model metadata dictionaries.
    """

    if scan_paths is None:
        scan_paths = [
            os.path.expanduser("~/.cache/llama.cpp/models"),
            os.path.expanduser("~/.cache/llama/models"),
            os.path.expanduser("~/models"),
            "/models",
            "./models",
        ]
    
    discovered_models = []
    
    for base_dir in scan_paths:
        if not os.path.exists(base_dir) or not os.path.isdir(base_dir):
            continue
            
        for root, _, files in os.walk(base_dir):
            for filename in files:
                if filename.lower().endswith(".gguf"):
                    file_path = os.path.join(root, filename)
                    stat = os.stat(file_path)
                    discovered_models.append({
                        "id": filename[:-5],
                        "name": filename[:-5],
                        "path": file_path,
                        "size_bytes": stat.st_size,
                        "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                        "source": "local",
                        "tags": ["gguf", "local"]
                    })
    
    return discovered_models

def download_model(model_id: str, local_dir: str = "./hf_models") -> str:
    """
    Downloads a model from Hugging Face to a local directory.
    
    Parameters:
        model_id: The Hugging Face model ID (e.g., 'meta-llama/Llama-2-7b').
        local_dir: The local directory to download to. Defaults to './hf_models'.
    
    Returns:
        The local path to the downloaded model.
    """
    try:
        from huggingface_hub import snapshot_download
        return snapshot_download(model_id, local_dir=local_dir)
    except ImportError:
        raise RuntimeError("huggingface_hub not installed. Install with: pip install huggingface_hub")
    except Exception as e:
        raise RuntimeError(f"Failed to download model {model_id}: {e}")
