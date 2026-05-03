from pathlib import Path
import os
import asyncio
import time
from typing import List, Dict, Optional, Any
from huggingface_hub import HfApi
import json
from datetime import datetime
from backend.config import LlamaConfig
from backend.exceptions import TransientProcessError
from backend.logger import get_logger, _VERBOSITY

logger = get_logger(__name__)


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

    def add_model(self, model_id: str, path: Path, metadata: Optional[Dict] = None):
        """Manually register a model."""
        self.register(model_id, path, metadata)

    def update_model(self, model_id: str, metadata: Optional[Dict] = None) -> bool:
        """Update metadata for an existing model."""
        if model_id not in self._models:
            return False
        if metadata is not None:
            self._models[model_id]["metadata"] = metadata
        return True

    def delete_model(self, model_id: str) -> bool:
        """Remove a model from the registry."""
        if model_id not in self._models:
            return False
        del self._models[model_id]
        return True

    def get_model_types(self) -> Dict[str, List[Dict[str, Any]]]:
        """Group models by their detected type."""
        groups: Dict[str, List[Dict[str, Any]]] = {"local": [], "huggingface": [], "template": []}
        for model_id, info in self._models.items():
            model_type = self._detect_model_type(model_id, info)
            groups.setdefault(model_type, []).append({
                "id": model_id,
                "path": str(info["path"]),
                "metadata": info.get("metadata"),
            })
        return groups

    @staticmethod
    def _detect_model_type(model_id: str, info: Dict[str, Any]) -> str:
        """Detect model type from ID and path."""
        path_str = str(info["path"]).lower()
        # Template reference: looks like a template name (no path separator, no .gguf)
        if "/" not in model_id and ":" not in model_id and not path_str.endswith(".gguf"):
            return "template"
        # HuggingFace identifier
        if "/" in model_id or "huggingface" in path_str or "hf" in path_str:
            return "huggingface"
        return "local"


class ModelManager:
    """Handles detection and retrieval of local and remote models."""

    # Quantization tags ordered by quality (highest first)
    QUANT_QUALITY_ORDER = [
        "FP16", "F16", "Q8_0", "Q6_K", "Q5_K_M", "Q5_K_S", "Q5_0",
        "Q4_K_M", "Q4_K_S", "Q4_0", "Q3_K_M", "Q3_K_S", "Q2_K",
    ]

    def __init__(self, config: LlamaConfig):
        self.config = config
        self.local_model_paths: List[Path] = config.local_model_search_paths
        self._semaphore = asyncio.Semaphore(4)
        self.registry = ModelRegistry()
        self.registry = ModelRegistry()

    def is_hf_identifier(self, identifier: str) -> bool:
        """Check if a string looks like a HuggingFace model identifier."""
        # HF identifiers have format: repo_id[:quant] or repo_id/filename
        return bool("/" in identifier)

    async def get_quantizations(self, model_id: str) -> List[Dict[str, Any]]:
        """Query HuggingFace API for available quantization variants of a model.

        model_id should be a HuggingFace repo identifier (with optional quantization tag).
        Returns list of QuantizationInfo dicts.
        """
        # Strip quantization tag to get base repo_id
        if ":" in model_id:
            repo_id = model_id.split(":")[0]
        else:
            repo_id = model_id

        # Extract quantization part if present
        quant_tag = None
        if ":" in model_id:
            quant_tag = model_id.split(":", 1)[1]

        try:
            api = HfApi(token=self.config.hf_api_key)
            model_info = api.model_info(repo_id)

            quantizations: List[Dict[str, Any]] = []
            gguf_files = []

            if hasattr(model_info, 'siblings') and model_info.siblings:
                for file_obj in model_info.siblings:
                    filename = getattr(file_obj, 'rfilename', '')
                    if filename.endswith('.gguf'):
                        gguf_files.append(filename)

            # Parse quantization tags from filenames
            for filename in gguf_files:
                quant = self._extract_quant_tag(filename)
                if quant:
                    quantizations.append({
                        "tag": quant,
                        "filename": filename,
                    })

            # Remove duplicates by tag, keeping the first occurrence
            seen_tags = set()
            unique_quantizations = []
            for q in quantizations:
                if q["tag"] not in seen_tags:
                    seen_tags.add(q["tag"])
                    unique_quantizations.append(q)

            # Mark recommended quantization (smallest high-quality option)
            recommended = self._pick_recommended(unique_quantizations)
            for q in unique_quantizations:
                q["isRecommended"] = q["tag"] == recommended

            # Sort by quality order
            unique_quantizations.sort(
                key=lambda q: self.QUANT_QUALITY_ORDER.index(q["tag"])
                if q["tag"] in self.QUANT_QUALITY_ORDER
                else len(self.QUANT_QUALITY_ORDER)
            )

            return unique_quantizations

        except Exception as e:
            logger.warning(f"Failed to fetch quantizations for {repo_id}: {e}")
            return []

    def _extract_quant_tag(self, filename: str) -> Optional[str]:
        """Extract quantization tag from a GGUF filename.

        Examples:
            'model.Q4_K_M.gguf' -> 'Q4_K_M'
            'model-F16.gguf' -> 'F16'
            'model.Q8_0.gguf' -> 'Q8_0'
        """
        stem = filename.replace('.gguf', '')
        # Match quantization patterns like Q4_K_M, Q8_0, F16, FP16, UD-Q4_K_M, etc.
        import re
        # Handle UD- prefixed quantizations
        match = re.search(r'(UD[-_]?(Q[0-9]_[KS]?[M]?|F[16]))$', stem)
        if match:
            return match.group(1).replace('_', '_')
        # Standard quantization pattern
        match = re.search(r'(Q[0-9]_[KS]?[M]?|Q[0-9]_0|Q[0-9]_K_[SL]?|F[16]|FP16)$', stem)
        if match:
            return match.group(1)
        return None

    def _pick_recommended(self, quantizations: List[Dict[str, Any]]) -> Optional[str]:
        """Pick the recommended quantization tag.

        Strategy: smallest quantization that provides good quality.
        Prefer Q4_K_M or Q5_K_M as they offer good quality/size balance.
        """
        preferred = ["Q4_K_M", "Q5_K_M", "Q5_K_S", "Q6_K", "Q8_0", "FP16", "F16",
                     "Q4_K_S", "Q4_0", "Q3_K_M", "Q3_K_S", "Q3_K_L", "Q2_K"]
        for tag in preferred:
            if any(q["tag"] == tag for q in quantizations):
                return tag
        return quantizations[0]["tag"] if quantizations else None

    def autodetect_local_models(self) -> List[Dict[str, Any]]:
        """
        Scans predefined local paths for GGUF models, correlating them with metadata files.
        Updates the internal ModelRegistry upon discovery by calling the standalone scan_local_models utility.

        Returns:
            List[Dict[str, Any]]: A list of discovered model metadata dictionaries.
        """
        return scan_local_models(self.registry, self.local_model_paths)

    async def search_huggingface(self, query: str, limit: int = 5) -> List[dict]:
        """
        Searches Hugging Face for models matching a query, implementing robust error handling
        and exponential backoff for rate limiting.

        Returns:
            List[dict]: Structured list of discovered models, or raises TransientProcessError on failure.
        """
        MAX_RETRIES = 5
        base_delay = 2  # Initial delay in seconds

        # Initialize API client with token
        try:
            api = HfApi(token=self.config.hf_api_key)
        except Exception as e:
            logger.error(f"Failed to initialize HfApi: {e}")
            raise TransientProcessError("Failed to initialize Hugging Face API client.")

        for attempt in range(MAX_RETRIES):
            try:
                # 1. Query the Hugging Face Hub (list_models is synchronous, returns a generator)
                logger.info(f"Attempt {attempt + 1}/{MAX_RETRIES}: Searching Hugging Face for models matching '{query}'...")
                search_results = api.list_models(search=query, limit=limit)

                # 2. Structure the returned data
                hf_models = []
                for result in search_results:
                    model_info = {
                        "name": getattr(result, "modelId", ""),
                        "id": getattr(result, "id", ""),
                        "description": getattr(result, "description", ""),
                        "author": getattr(result, "author", None),
                        "repo_type": "model",
                        "license": getattr(result, "license", None),
                        "last_modified": getattr(result, "last_modified", None),
                        "downloads": getattr(result, "downloads", None),
                        "source": "hf",
                        "tags": getattr(result, "tags", []),
                    }
                    hf_models.append(model_info)

                # Success: Return models
                return hf_models

            except TransientProcessError as e:
                if attempt < MAX_RETRIES - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        f"Rate limit or transient error encountered. Retrying in {delay:.2f} seconds... (Attempt {attempt + 1}/{MAX_RETRIES})"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Exceeded max retries for Hugging Face search after {MAX_RETRIES} attempts.")
                    raise TransientProcessError(f"Hugging Face search failed after multiple retries: {e}")

            except Exception as e:
                # Catch other non-transient errors (e.g., invalid query, network down)
                logger.error(f"Critical, non-retriable error during Hugging Face search: {e}")
                raise TransientProcessError(f"Critical error during Hugging Face search: {e}")

    def _search_huggingface_sync(self, query: str, limit: int = 5) -> List[dict]:
        """Synchronous wrapper around the async search_huggingface method."""
        try:
            return asyncio.run(self.search_huggingface(query, limit))
        except RuntimeError as e:
            if "no running event loop" in str(e):
                return asyncio.run(self.search_huggingface(query, limit))
            raise

    async def run_benchmark(self, model_paths: List[Path], runner: "LlamaRunner"):
        """
        Runs a standardized benchmark across multiple selected models concurrently.
        Uses asyncio.gather() with semaphore throttling to limit concurrent runs.
        """
        logger.info("\n--- STARTING ARENA BENCHMARK ---")

        benchmark_prompt = "Write a short, imaginative poem about a space journey, focusing on wonder and solitude."
        results = {}

        async def run_single_model(model_path: Path, index: int) -> tuple:
            """Run a single model benchmark with throttling."""
            async with self._semaphore:
                model_name = Path(model_path).stem.replace("-", "_")
                logger.info(
                    f"\n--- Benchmarking Model {index + 1}/{len(model_paths)}: {model_name} ---"
                )
                try:
                    t0 = time.perf_counter()
                    output_text = await runner.run_model_async(
                        str(model_path), benchmark_prompt
                    )
                    elapsed = time.perf_counter() - t0
                    token_count = len(output_text.split())
                    throughput = round(token_count / elapsed, 2) if elapsed > 0 else 0

                    results[model_name] = {
                        "path": model_path,
                        "output": output_text,
                        "word_count": token_count,
                        "elapsed_seconds": round(elapsed, 3),
                        "throughput_tokens_per_second": throughput,
                    }
                    logger.info(
                        f"✅ {model_name} finished. Tokens: {token_count} in {elapsed:.2f}s ({throughput} tok/s)"
                    )
                except Exception as e:
                    logger.error(f"❌ Failed to run {model_name}: {e}")
                    results[model_name] = {"error": str(e)}

        tasks = [run_single_model(model_paths[i], i) for i in range(len(model_paths))]
        await asyncio.gather(*tasks)

        logger.info("\n======================================")
        logger.info("🏆 Benchmark Results Summary")
        logger.info("======================================")

        for name, data in results.items():
            if "error" in data:
                logger.error(f"[{name}] ERROR: {data['error']}")
            else:
                throughput = data.get('throughput_tokens_per_second', 0)
                elapsed = data.get('elapsed_seconds', 0)
                logger.info(
                    f"\n--- Results for {name} ({data['word_count']} words, "
                    f"{elapsed:.2f}s, {throughput} tok/s) ---"
                )
                logger.info(data["output"])

        logger.info("\nBenchmark complete.")

    def search_huggingface_sync(self, query: str, limit: int = 5) -> List[dict]:
        """Synchronous wrapper around the async search_huggingface method."""
        try:
            return asyncio.run(self.search_huggingface(query, limit))
        except RuntimeError as e:
            if "no running event loop" in str(e):
                return asyncio.run(self.search_huggingface(query, limit))
            raise

    def run_benchmark_sync(
        self, model_paths: List[Path], runner
    ) -> Dict[str, Any]:
        """Synchronous wrapper around the async run_benchmark method.

        Returns a dict mapping model names to their benchmark results.
        """
        try:
            return asyncio.run(self.run_benchmark(model_paths, runner))
        except RuntimeError as e:
            if "no running event loop" in str(e):
                return asyncio.run(self.run_benchmark(model_paths, runner))
            raise

def scan_local_models(registry: ModelRegistry, scan_paths: Optional[List[Path]] = None) -> List[Dict[str, Any]]:
    """
    Scans specified directories for GGUF models, correlating them with metadata files.
    Updates the provided ModelRegistry upon discovery.

    Parameters:
        registry: The ModelRegistry instance to populate with discovered models.
        scan_paths: Optional list of directories to scan. If None, uses default cache/local paths.

    Returns:
        List[Dict[str, Any]]: A list of discovered model metadata dictionaries.
    """
    discovered_models = []

    if scan_paths is None:
        scan_paths = [
            Path(os.path.expanduser("~/.cache/llama.cpp/models")),
            Path(os.path.expanduser("~/.cache/llama/models")),
            Path(os.path.expanduser("~/models")),
            Path("/models"),
            Path("./models"),
        ]

    scan_paths = [Path(p) if isinstance(p, str) else p for p in scan_paths]

    for base_path in scan_paths:
        abs_search_path = base_path.resolve()
        if not abs_search_path.is_dir():
            logger.debug(
                f"Scan path not found (skipping): {abs_search_path}"
            )
            continue
        
        gguf_files = []

        # --- 1. Detect GGUF files based on path structure (HF Cache vs Flat) ---
        is_hf_cache = False
        hf_model_dirs = []
        for entry in abs_search_path.iterdir():
            if entry.is_dir() and entry.name.startswith("models--"):
                is_hf_cache = True
                hf_model_dirs.append(entry)

        if is_hf_cache:
            # Search HF cache structure
            for model_dir in hf_model_dirs:
                for snapshot_dir in model_dir.glob("snapshots/*/"):
                    snapshot_path = Path(snapshot_dir)
                    if snapshot_path.is_dir():
                        for gguf_file in snapshot_path.glob("*.gguf"):
                            gguf_files.append(gguf_file)
                blobs_dir = model_dir / "blobs"
                if blobs_dir.exists() and blobs_dir.is_dir():
                    for gguf_file in blobs_dir.glob("*.gguf"):
                        gguf_files.append(gguf_file)
        else:
            # Search flat structure or nested subdirectories
            # 1. Find files directly in the current base_path
            for gguf_file in abs_search_path.glob("*.gguf"):
                gguf_files.append(gguf_file)
            
            # 2. Recurse into subdirectories
            for entry in abs_search_path.iterdir():
                if entry.is_dir():
                    # Use glob recursively to find all files in subdirs
                    for gguf_file in entry.rglob("*.gguf"):
                        gguf_files.append(gguf_file)
        
        # --- 2. Process GGUF Files and Correlate Metadata ---
        for file_path in gguf_files:
            model_id = None
            metadata = None
            try:
                # Attempt to find companion metadata file (.json, .yaml, .yml)
                for suffix in [".json", ".yaml", ".yml"]:
                    metadata_path = file_path.parent / f"{file_path.stem}{suffix}"
                    if metadata_path.exists():
                        logger.debug(f"Correlating metadata for {file_path.name}")
                        try:
                            if metadata_path.suffix == ".json":
                                with open(metadata_path, "r") as f:
                                    metadata = json.load(f)
                                # Use 'id' from metadata if present, otherwise use filename stem
                                model_id = metadata.get("id", file_path.stem)
                            else:
                                # Placeholder for YAML/YML parsing (assuming filename stem for simplicity)
                                model_id = file_path.stem
                        except Exception as e:
                            logger.error(
                                f"Error parsing metadata file {metadata_path.name}: {e}. Using filename stem.",
                                extra_data={"filepath": str(metadata_path)}
                            )
                            model_id = file_path.stem
                        break
                
                # Fallback ID if no metadata found
                if model_id is None:
                    model_id = file_path.stem
            
                # Avoid duplicates based on model_id
                if model_id not in registry.list_all():
                    stat = file_path.stat()
                    model_info = {
                        "id": model_id,
                        "path": str(file_path),
                        "metadata": metadata,
                        "size_bytes": stat.st_size,
                        "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                        "source": "local",
                        "tags": ["gguf", "local"]
                    }
                    registry.register(model_id, file_path, metadata)
                    discovered_models.append(model_info)
                    logger.debug(f"Registered model '{model_id}'")
            
            except FileNotFoundError as e:
                # 4. Error Handling
                logger.error(f"File I/O Error: {e}. Skipping file.", extra_data={"filepath": str(file_path)})
            except Exception as e:
                # 4. Error Handling for general exceptions
                logger.error(
                    f"General error processing file {file_path.name}: {e}",
                    extra_data={"filepath": str(file_path)}
                )
                
    logger.debug(f"Local model scan complete: {len(discovered_models)} models found.")
    return discovered_models

def download_model(model_id: str, local_dir: str = "./hf_models", quantization: Optional[str] = None) -> str:
    """
    Downloads a model from Hugging Face to a local directory.

    Parameters:
        model_id: The Hugging Face model ID (e.g., 'meta-llama/Llama-2-7b').
        local_dir: The local directory to download to. Defaults to './hf_models'.
        quantization: Optional quantization tag to filter files (e.g., 'Q4_K_M').

    Returns:
        The local path to the downloaded model.
    """
    try:
        from huggingface_hub import snapshot_download, hf_hub_download

        # If model_id contains a quantization tag (e.g., "repo:Q4_K_M"), parse it
        base_repo = model_id
        target_quant = quantization
        if ":" in model_id and not target_quant:
            parts = model_id.split(":", 1)
            base_repo = parts[0]
            target_quant = parts[1]

        # If quantization specified, try to find and download specific file
        if target_quant:
            try:
                api = HfApi()
                files = api.list_repo_files(base_repo)
                gguf_files = [f for f in files if f.endswith('.gguf') and target_quant in f]
                if gguf_files:
                    target_file = gguf_files[0]
                    Path(local_dir).mkdir(parents=True, exist_ok=True)
                    return hf_hub_download(
                        repo_id=base_repo,
                        filename=target_file,
                        local_dir=local_dir,
                    )
            except Exception:
                pass

        # Fallback: download entire repo
        Path(local_dir).mkdir(parents=True, exist_ok=True)
        return snapshot_download(base_repo, local_dir=local_dir)

    except ImportError:
        raise RuntimeError("huggingface_hub not installed. Install with: pip install huggingface_hub")
    except Exception as e:
        raise RuntimeError(f"Failed to download model {model_id}: {e}")
