# llama_launcher/model_manager.py

import logging
from pathlib import Path
from typing import List, Dict
from huggingface_hub import list_models, HfApi


class ModelManager:
    """Handles detection and retrieval of local and remote models."""

    def __init__(self, config):
        self.config = config
        self.local_model_paths: List[Path] = config.local_model_search_paths

    def autodetect_local_models(self) -> Dict[str, Path]:
        """
        Scans predefined local paths for GGUF files.
        Returns a dictionary mapping model name (e.g., 'llama-7b') to its Path.
        """
        detected_models = {}
        for path in self.local_model_paths:
            if not path.exists():
                continue

            # Search for common GGUF files
            for file_path in path.glob("*/*.gguf"):
                # Simple naming convention for demonstration
                model_name = file_path.stem.split("-")[0]
                if model_name not in detected_models:
                    detected_models[model_name] = file_path

        return detected_models

    def search_huggingface(self, query: str, limit: int = 5) -> List[Dict]:
        """
        Searches Hugging Face for models matching a query.
        """
        try:
            api = HfApi()
            # Search repositories by name
            # Use the dedicated list_models function for searching
            search_results = api.list_models(search=query, limit=limit)

            # Transform results into a simpler dictionary format
            hf_models = []
            for result in search_results:
                hf_models.append(
                    {
                        "name": result.modelId,
                        "id": result.repo_id,
                        "description": result.description,
                        "tags": result.tags,
                    }
                )
            return hf_models
        except Exception as e:
            logging.error(f"Error during Hugging Face search: {e}")

    def download_model(self, model_id: str, local_dir: Path) -> Path:
        """
        Downloads a specific model from Hugging Face to the local_dir.
        Returns the Path to the downloaded GGUF model.
        """
        try:
            api = HfApi()
            # The download function handles the actual file retrieval
            downloaded_path = api.hf_hub_download(
                repo_id=model_id, filename="llama.gguf", local_dir=local_dir
            )
            logging.info(f"✅ Successfully downloaded {model_id} to {downloaded_path}")
            return downloaded_path
        except Exception as e:
            logging.error(f"❌ Error downloading model {model_id}: {e}")
            return None

    def run_benchmark(self, model_paths: List[Path], runner: "LlamaRunner"):
        """
        Runs a standardized benchmark across multiple selected models.
        """
        click.echo("\n======================================")
        click.echo("🔬 Starting Arena Benchmark...")
        click.echo("======================================")

        benchmark_prompt = "Write a short, imaginative poem about a space journey, focusing on wonder and solitude."
        results = {}

        for i, model_path in enumerate(model_paths):
            model_name = Path(model_path).stem.replace("-", "_")
            click.echo(
                f"\n--- Benchmarking Model {i + 1}/{len(model_paths)}: {model_name} ---"
            )

            try:
                # Assuming LlamaRunner has a run_model method that accepts a path and prompt
                # We must use the runner instance passed into this method.
                # Note: This assumes runner.run_model is safe to call repeatedly without resource issues.
                # For a real benchmark, one might need to manage processes more carefully.

                # We will use a simplified run that just returns the generated text for comparison
                output_text = runner.run_model_sync(str(model_path), benchmark_prompt)

                results[model_name] = {
                    "path": model_path,
                    "output": output_text,
                    "word_count": len(output_text.split()),
                }
                click.echo(
                    f"✅ {model_name} finished. Word count: {len(output_text.split())}"
                )
            except Exception as e:
                click.echo(f"❌ Failed to run {model_name}: {e}")
                results[model_name] = {"error": str(e)}

        click.echo("\n======================================")
        click.echo("🏆 Benchmark Results Summary")
        click.echo("======================================")

        for name, data in results.items():
            if "error" in data:
                click.echo(f"[{name}] ERROR: {data['error']}")
            else:
                click.echo(
                    f"\n--- Results for {name} ({len(data['output'].split())} words) ---"
                )
                click.echo(data["output"])

        click.echo("\nBenchmark complete.")
