# llama_launcher/cli.py

import click
from pathlib import Path
from llama_launcher.config import load_config
from llama_launcher.model_manager import ModelManager
from llama_launcher.llama_runner import LlamaRunner


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
    help="Custom comma-separated llama.cpp options (e.g., temp=0.8,n_ctx=4096).",
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
                resolved_model_path = detected_models[name]
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

        # 4. Parse Custom Options (Basic implementation)
        custom_opts = {}
        if options:
            for item in options.split(","):
                if "=" in item:
                    key, value = item.split("=")
                    custom_opts[key.strip()] = value.strip()

        # 5. Run Model and Stream Output
        click.echo("======================================")
        click.echo("🚀 Llama Launcher Initializing...")
        click.echo("======================================")

        process = runner.run_model(str(resolved_model_path), custom_opts)

        if background:
            click.echo("✨ Running in background. PID: {}".format(process.pid))
            # Detach the process and exit the CLI
            process.detach()
            return

        # Write initial prompt to stdin (required for many LLMs)
        if process is not None:
            process.stdin.write(prompt + "\n")
            process.stdin.flush()

            # Stream output line by line
            while True:
                output = process.stdout.readline()
                if output == "" and process.poll() is not None:
                    break
                if output:
                    # Print output directly to simulate interactive UI
                    print(output.strip())

            # Wait for the process to fully terminate and get the return code
            return_code = process.wait()

            if return_code == 0:
                click.echo("\n======================================")
                click.echo("✅ Model generation complete successfully.")
                click.echo("======================================")
            else:
                click.echo("\n======================================")
                click.echo(
                    f"❌ Model generation failed. Llama.cpp exited with code {return_code}."
                )
                click.echo("======================================")

    except FileNotFoundError as e:
        click.echo(f"ERROR: Configuration file missing. {e}")
    except RuntimeError as e:
        click.echo(f"CRITICAL RUNTIME ERROR: {e}")
    except Exception as e:
        click.echo(f"An unexpected error occurred: {e}")


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
        # For simplicity and robustness, we check for a running process that looks like a server.
        result = terminal(command="pgrep -f 'llama.cpp.*server' | xargs ps aux")
        output = result.get("output", "")

        if not output.strip():
            click.echo("  (No running llama.cpp server process found.)")
            return

        click.echo("✅ Server Process Detected. Details:")
        click.echo(output)

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
        # Use terminal tool for OS interaction
        result = terminal(command="ps aux | grep llama.cpp")
        output = result.get("output", "")

        if not output.strip():
            click.echo("  (No running llama.cpp processes found.)")
            return

        click.echo(output)

    except Exception as e:
        click.echo(f"❌ Failed to run process check: {e}")
        if process is not None:
            process.stdin.write(prompt + "\n")
            process.stdin.flush()

            # Stream output line by line
            while True:
                output = process.stdout.readline()
                if output == "" and process.poll() is not None:
                    break
                if output:
                    # Print output directly to simulate interactive UI
                    print(output.strip())

            # Wait for the process to fully terminate and get the return code
            return_code = process.wait()

            if return_code == 0:
                print("\n======================================")
                print("✅ Model generation complete successfully.")
                print("======================================")
            else:
                print("\n======================================")
                print(
                    f"❌ Model generation failed. Llama.cpp exited with code {return_code}."
                )
                print("======================================")


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
        # For simplicity and robustness, we check for a running process that looks like a server.
        result = terminal(command="pgrep -f 'llama.cpp.*server' | xargs ps aux")
        output = result.get("output", "")

        if not output.strip():
            click.echo("  (No running llama.cpp server process found.)")
            return

        click.echo("✅ Server Process Detected. Details:")
        click.echo(output)

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
        # Use terminal tool for OS interaction
        result = terminal(command="ps aux | grep llama.cpp")
        output = result.get("output", "")

        if not output.strip():
            click.echo("  (No running llama.cpp processes found.)")
            return

        click.echo(output)

    except Exception as e:
        click.echo(f"❌ Failed to run process check: {e}")

    except FileNotFoundError as e:
        click.echo(f"ERROR: {e}")
    except Exception as e:
        click.echo(f"An unexpected error occurred: {e}")


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
        available_models = {
            k: {"type": "local", "path": v} for k, v in local_models.items()
        }

        # Prompt user to select models
        click.echo("======================================")
        click.echo("⚔️ Llama Launcher Model Arena")
        click.echo("======================================")

        model_choices = {}
        for i, (name, details) in enumerate(available_models.items()):
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
            if i < len(available_models):
                model_name = list(available_models.keys())[i]
                selected_models.append(available_models[model_name]["path"])
            else:
                click.echo(f"Invalid model number: {i + 1}")
                return

        if not selected_models:
            click.echo("No models selected. Exiting.")
            return

        click.echo(
            f"\n🚀 Starting Arena Benchmark for {len(selected_models)} models..."
        )

        # Delegate benchmarking to ModelManager (or a dedicated ArenaRunner)
        runner = LlamaRunner(config)
        manager.run_benchmark(selected_models, runner)

    except Exception as e:
        click.echo(f"ERROR: Failed to run the Model Arena. {e}")
    try:
        config = load_config()
        manager = ModelManager(config)

        # Autodetect and list local models
        local_models = manager.autodetect_local_models()

        click.echo("======================================")
        click.echo("🤖 Detected Local Models:")
        if local_models:
            for name, path in local_models.items():
                click.echo(f"  - {name} (Path: {path})")
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

    except Exception as e:
        click.echo(f"Error listing models: {e}")
