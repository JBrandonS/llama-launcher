# llama_launcher/cli.py
import asyncio
import click
from pathlib import Path
from llama_launcher.config import load_config
from llama_launcher.model_manager import ModelManager
from llama_launcher.llama_runner import LlamaRunner
import json


@click.group()
def cli():
    """
    Llama Launcher CLI: An interactive launcher for llama.cpp.
    """
    pass


@cli.command()
@click.option(
    "--model",
    type=click.Path(exists=True, path_type=Path),
    help="Path to the GGUF model to run.",
)
@click.option(
    "--name", type=str, help="Shortcut name of a detected model (e.g., qwen3)."
)
@click.option("--prompt", type=str, help="The initial prompt for the model.")
@click.option(
    "--options",
    type=str,
    help="Custom comma-separated llama.cpp options (e.g., temp=0.8,n_ctx=4096) or JSON string.",
)
@click.option(
    "--background", is_flag=True, help="Run the model as a detached background process."
)
def run(model: Path, name: str, prompt: str, options: str, background: bool):
    """
    Runs the specified model using llama.cpp. Can accept a full path OR a shortcut name.
    """
    try:
        # 1. Load Configuration
        config = load_config()

        # 2. Initialize components
        model_manager = ModelManager(config)
        runner = LlamaRunner(config)

        # 3. Resolve Model Path (Priority: Name > Path)
        resolved_model_path = None
        if name:
            # Attempt to resolve shortcut name
            detected_models = model_manager.autodetect_local_models()
            if name in detected_models:
                resolved_model_path = detected_models[name]["path"]
                click.echo(
                    f"✅ Resolved model name '{name}' to path: {resolved_model_path}"
                )
            else:
                click.echo(
                    f"ERROR: Model shortcut '{name}' not found. Available models: {list(detected_models.keys())}"
                )
                return
        elif model:
            # Use provided path directly
            resolved_model_path = model
        else:
            click.echo("ERROR: Must specify either --name or --model path.")
            return

        # 4. Parse Custom Options
        custom_opts = {}
        if options:
            try:
                # Attempt to parse options as a JSON dictionary for robust handling
                custom_opts = json.loads(options)
            except json.JSONDecodeError:
                # Fallback to comma-separated key=value format if JSON parsing fails
                for item in options.split(","):
                    if "=" in item:
                        key, value = item.split("=")
                        custom_opts[key.strip()] = value.strip()
                click.echo(
                    f"⚠️ Warning: Options were parsed using comma-separated key=value format."
                )

        # 5. Run Model using Mock Runner (Scaffolding Phase)
        click.echo("======================================")
        click.echo("🚀 Llama Launcher Running Mock Model Runner...")
        click.echo("======================================")

        try:
            # Call the mock runner to satisfy the interface contract
            mock_result = runner.run_model_mock(
                str(resolved_model_path), prompt, custom_opts
            )

            # Output the deterministic mock result as JSON for easy verification
            print(json.dumps(mock_result, indent=2))

        except ValueError as e:
            click.echo(f"\n❌ Input Validation Error: {e}")
    except Exception as e:
        click.echo(f"\n❌ A general error occurred during mock execution: {e}")
    finally:
        click.echo("======================================")
        click.echo(
            "✅ Mock model run completed. (This is a scaffold and does not execute llama.cpp yet.)"
        )
        click.echo("======================================")


@cli.command()
def server_status():
    """
    Checks the status and operational information of a running llama.cpp server.
    NOTE: This command requires a server process to be running and accessible.
    """
    click.echo("=======================================")
    click.echo("🌐 Llama.cpp Server Status Check")

    try:
        # Attempt to query a running process or check a known port/endpoint
        # For simplicity and robustness, check for a running process
        import subprocess

        result = subprocess.run(
            ["pgrep", "-f", "llama.cpp.*server"],
            capture_output=True,
            text=True,
        )

        if not result.stdout.strip():
            click.echo("  (No running llama.cpp server process found.)")
            return

        click.echo("✅ Server Process Detected. Details:")
        output = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
        )
        for line in output.stdout.split("\n"):
            if "llama.cpp" in line:
                click.echo(line)

    except Exception as e:
        click.echo(f"❌ Failed to check server status: {e}")


@cli.command()
def ps():
    """
    Lists all running llama.cpp processes.
    """
    click.echo("=======================================")
    click.echo("🔍 Running llama.cpp Processes:")

    try:
        import subprocess

        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
        )
        output = result.stdout

        if not output.strip():
            click.echo("  (No running llama.cpp processes found.)")
            return

        click.echo(output)

    except Exception as e:
        click.echo(f"❌ Failed to run process check: {e}")


@cli.command()
def arena():
    """
    Launches the model arena for benchmarking selected models against each other.
    """
    try:
        config = load_config()
        manager = ModelManager(config)

        # Get all local models for selection
        local_models = manager.autodetect_local_models()
        available_models = list(local_models.keys())  # Just use the model IDs

        # Prompt user to select models
        click.echo("======================================")
        click.echo("⚔️ Llama Launcher Model Arena")
        click.echo("======================================")

        for i, name in enumerate(available_models):
            click.echo(f"[{i + 1}] {name} (Local)")

        model_names_selected = click.prompt(
            "Enter the numbers of the models you want to benchmark (comma-separated)",
            type=str,
            default="",
        )

        selected_names = [
            int(n.strip()) - 1 for n in model_names_selected.split(",") if n.strip()
        ]

        selected_models = []
        for i in selected_names:
            if 0 <= i < len(available_models):
                model_name = available_models[i]
                path = manager.registry.get_path(model_name)
                if path:
                    selected_models.append(path)
                else:
                    click.echo(f"Invalid model number: {i + 1}")
                    return
            else:
                click.echo(f"Invalid model number: {i + 1}")
                return

        if not selected_models:
            click.echo("No models selected. Exiting.")
            return

        click.echo(
            f"\n🚀 Starting Arena Benchmark for {len(selected_models)} models..."
        )

        # Delegate benchmarking to ModelManager
        runner = LlamaRunner(config)
        manager.run_benchmark(selected_models, runner)

    except Exception as e:
        click.echo(f"ERROR: Failed to run the Model Arena. {e}")


@cli.command()
def list_models():
    """
    Lists available models from local storage and Hugging Face.
    """
    try:
        config = load_config()
        manager = ModelManager(config)

        # Autodetect and list local models
        local_models = manager.autodetect_local_models()

        click.echo("======================================")
        click.echo("🤖 Detected Local Models:")
        if local_models:
            for model_id, info in local_models.items():
                path = info.get("path")
                click.echo(f"  - {model_id} (Path: {path})")
        else:
            click.echo("  (No local GGUF models found.)")

        # Search Hugging Face
        hf_query = config.default_hf_search_query
        click.echo(f"\n======================================")
        click.echo(f"🌐 Searching Hugging Face for: '{hf_query}'")

        hf_results = manager.search_huggingface(hf_query, limit=5)

        if hf_results:
            for i, res in enumerate(hf_results):
                click.echo(f"  [{i + 1}] {res['name']}")
                click.echo(f"      Description: {res['description']}")
                click.echo(f"      Tags: {', '.join(res['tags'])}")
        else:
            click.echo("  (No results found on Hugging Face or an error occurred.)")

        click.echo("======================================")

    except Exception as e:
        click.echo(f"ERROR: Failed to list models. {e}")


if __name__ == "__main__":
    cli()
