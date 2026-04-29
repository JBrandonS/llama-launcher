import asyncio
import json
import os
import subprocess
import time
import urllib.request
import click
from pathlib import Path
from typing import Optional

from backend.config import load_config, LlamaConfig
from backend.model_manager import ModelManager
from backend.llama_runner import LlamaRunner
from backend.logger import setup_logger
from backend.process_manager import ProcessManager
from backend.download import download_model as hf_download
from backend.config_store import ConfigStore, ConfigItem
from backend.benchmark import run_benchmark as bench_run
from backend.daemon import start_daemon, stop_daemon, _global_daemon, generate_systemd_service


@click.group()
@click.option("-v", "--verbose", is_flag=True, help="Show info messages")
@click.option("-vv", "--debug", is_flag=True, help="Show detailed debug logging")
def cli(verbose, debug):
    setup_logger(verbose=verbose, debug=debug)



def _select_model_interactive(config: LlamaConfig):
    manager = ModelManager(config)
    models = manager.autodetect_local_models()
    if not models:
        click.echo("No local models found. Run 'llama-launcher download' or list-models.")
        return None, {}

    click.echo(f"\nFound {len(models)} model(s):\n")
    for i, m in enumerate(models):
        size_mb = m.get('size_bytes', 0) / (1024 * 1024) if isinstance(m.get('size_bytes'), (int, float)) else 0
        click.echo(f"  [{i + 1}] {m['id']}  ({size_mb:.1f} MB)")
    click.echo()

    choice = click.prompt("Select model", type=int, default=1)
    if choice < 1 or choice > len(models):
        click.echo("Invalid selection.")
        return None, {}

    model = models[choice - 1]
    opts = {}
    if 'metadata' in model and isinstance(model['metadata'], dict):
        opts.update({k: v for k, v in model['metadata'].items() if k != 'id'})
    return model['path'], opts


@cli.command()
@click.option("--model", type=click.Path(exists=True), help="Path to GGUF model file.")
@click.option("--name", type=str, help="Named model from detected models.")
@click.option("--prompt", type=str, default=None, help="Initial prompt text.")
@click.option("--options", type=str, default=None,
              help="Comma-separated key=value options (e.g. temp=0.8,n_ctx=2048).")
@click.option("--foreground", "-F", is_flag=True, help="Run in foreground (opposite of default background).")
@click.option("--port", "-P", type=int, default=None, help="Port for server (default: from config or 12345).")
@click.option("--threads", type=int, default=None, help="Override thread count.")
def run(model, name, prompt, options, foreground, port, threads):
    """Run a model interactively or in the background."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        model_manager = ModelManager(config)
        runner = LlamaRunner(config)

        if not name and not model:
            resolved_path, extra_opts = _select_model_interactive(config)
            if not resolved_path:
                return
            model = str(resolved_path)
            if options and extra_opts:
                for k, v in extra_opts.items():
                    if k != 'id':
                        try:
                            v = float(v)
                        except (ValueError, TypeError):
                            pass
                        click.echo(f"Applying recommended option: {k}={v}")
        elif name:
            detected = model_manager.autodetect_local_models()
            if name in [m['id'] for m in detected]:
                match = next(m for m in detected if m['id'] == name)
                model = str(match['path'])
            else:
                click.echo(f"ERROR: Model '{name}' not found. Use --model or omit both for interactive selection.")
                return

        custom_opts = {}
        if options:
            for item in options.split(','):
                if '=' in item:
                    k, v = item.split('=', 1)
                    try:
                        v = float(v) if '.' in v else int(v)
                    except (ValueError, TypeError):
                        pass
                    custom_opts[k.strip()] = v

        if threads is not None:
            custom_opts['threads'] = threads

        if not foreground:
            pm = ProcessManager(config)
            model_path = Path(model).resolve()
            ctx = getattr(config, 'n_ctx', 4096)
            gpu_layers = getattr(config, 'n_gpu_layers', -1)
            temp = custom_opts.get('temp', getattr(config, 'temperature', 0.7))

            result = pm.start_server(
                model_path=str(model_path),
                port=port,
                n_ctx=ctx,
                n_gpu_layers=gpu_layers,
                threads=custom_opts.get('threads', getattr(config, 'threads', 8)),
                temp=temp,
            )
            click.echo(f"Background server started on port {port} (PID {result['pid']}).")
            return

        prompt_text = prompt or "Hello"
        output = runner.run_model_sync(model, prompt_text, custom_opts if custom_opts else None)
        click.echo(output)

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('list-models')
@click.option("--hf-query", type=str, default=None, help="HuggingFace search query.")
@click.option("--names-only", is_flag=True, help="Show only model names (one per line).")
def list_models(hf_query, names_only):
    """List local models and optionally search HuggingFace."""
    try:
        config = load_config()
        manager = ModelManager(config)

        if names_only:
            local = manager.autodetect_local_models()
            for m in local:
                click.echo(m['id'])
            return

        click.echo("Local Models:")
        click.echo("=" * 50)
        local = manager.autodetect_local_models()
        if local:
            for m in local:
                size_mb = m.get('size_bytes', 0) / (1024 * 1024) if isinstance(m.get('size_bytes'), (int, float)) else 0
                click.echo(f"  [{m['id']}]  {m['path']}  ({size_mb:.1f} MB)")
        else:
            click.echo("  (none found)")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('search')
@click.argument('query', type=str, required=False, default='')
def search(query):
    """Search HuggingFace for llama.cpp GGUF models."""
    try:
        config = load_config()
        manager = ModelManager(config)
        q = query or click.prompt("Search query", default="llama3 gguf")

        click.echo(f"Searching HuggingFace for '{q}'...")
        results = manager.search_huggingface_sync(q, limit=10)
        if results:
            for i, r in enumerate(results):
                click.echo(f"\n  {i+1}. {r['name']}")
                desc = r.get('description', '') or ''
                if len(desc) > 120:
                    desc = desc[:117] + '...'
                click.echo(f"     {desc}")
        else:
            click.echo("  No results found.")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('download')
@click.argument('model_id', type=str)
@click.option("--dir", "dest_dir", type=click.Path(), default=None, help="Destination directory.")
@click.option("--token", type=str, default=None, hidden=True, help="HF token.")
def download(model_id, dest_dir, token):
    """Download a GGUF model from HuggingFace."""
    try:
        local_dir = dest_dir or str(Path.home() / '.cache' / 'huggingface' / 'hub')
        path = hf_download(model_id, local_dir=local_dir, token=token)
        click.echo(f"Downloaded to: {path}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('model-cards')
@click.argument('model_id', type=str)
def model_cards(model_id):
    """Display a HuggingFace model card for recommended settings."""
    try:
        from backend.model_cards import parse_model_card, get_recommended_params
        params = get_recommended_params(model_id)
        if not params:
            click.echo(f"Could not retrieve card for '{model_id}'.")
            return
        click.echo(f"\n=== {params['name']} ===")
        if params.get('description'):
            desc = params['description']
            if len(desc) > 200:
                desc = desc[:197] + '...'
            click.echo(f"Description: {desc}")
        if params.get('author'):
            click.echo(f"Author: {params['author']}")
        if params.get('tags'):
            click.echo(f"Tags: {', '.join(params['tags'])}")
        recommended = get_recommended_params(model_id)
        cli_flags = recommended.get('cli_flags')
        if cli_flags:
            click.echo(f"\nRecommended flags:")
            for f in cli_flags:
                click.echo(f"  {f}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command()
@click.option("--json", "as_json", is_flag=True, flag_value="true", help="Output as JSON.")
def ps(as_json):
    """List running llama.cpp servers."""
    try:
        pm = ProcessManager()
        servers = pm.list_servers()
        if as_json:
            click.echo(json.dumps(list(servers.values()), indent=2))
            return

        if not servers:
            click.echo("No running servers.")
            return
        for port, info in servers.items():
            try:
                os.kill(info['pid'], 0)
                state = "running"
            except OSError:
                state = "stale"
            click.echo(f"[{state}] port={port} pid={info['pid']} model={Path(info.get('model', '')).name}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command()
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
def server_status(port):
    """Check status of a background server."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        pm = ProcessManager()
        status = pm.status(port)
        if status.get('status') == 'running':
            click.echo(f"Server running on port {port} (PID {status['pid']})")
        elif status.get('status') == 'not_running':
            click.echo(f"No server on port {port}.")
        else:
            click.echo(f"Server status: {status.get('status')}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command()
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
def stop(port):
    """Stop a background server."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        pm = ProcessManager()
        result = pm.stop_server(port)
        click.echo(f"Server on port {port}: {result['status']}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('arena')
def arena():
    """Benchmark multiple models head-to-head."""
    try:
        config = load_config()
        manager = ModelManager(config)
        local = manager.autodetect_local_models()
        if not local:
            click.echo("No local models to benchmark.")
            return

        paths = [m['path'] for m in local]
        runner = LlamaRunner(config)
        result = asyncio.run(manager.run_benchmark(paths, runner))
        click.echo(json.dumps(result, indent=2, default=str))
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('save-config')
@click.option("--name", type=str, default="default", help="Config name.")
@click.option("--model", type=click.Path(), default=None, help="Default model path.")
@click.option("--n-gpu-layers", type=int, default=None, help="GPU layers.")
@click.option("--threads", type=int, default=None, help="Thread count.")
@click.option("--force", "-f", is_flag=True, help="Overwrite existing config.")
def save_config(name, model, n_gpu_layers, threads, force):
    """Save a named configuration profile."""
    try:
        store = ConfigStore()
        data = {
            'default_model_path': str(Path(model).resolve()) if model else None,
            'n_gpu_layers': n_gpu_layers,
            'threads': threads,
        }
        path = store.save(name, data, force=force)
        click.echo(f"Config '{name}' saved to {path}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('load-config')
@click.option("--name", type=str, default="default", help="Config name to display.")
def load_config_cmd(name):
    """Display a saved configuration profile."""
    try:
        store = ConfigStore()
        config = store.load(name)
        for k, v in sorted(config.config.items()):
            if v is not None:
                click.echo(f"  {k}: {v}")
    except FileNotFoundError:
        click.echo(f"Config '{name}' not found.")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('list-configs')
def list_configs():
    """List all saved configuration profiles."""
    try:
        store = ConfigStore()
        configs = store.list_configs()
        if not configs:
            click.echo("No saved configs.")
            return
        for c in configs:
            model = Path(c.get('default_model_path', 'N/A')).name if c.get('default_model_path') else 'N/A'
            gpu = c.get('n_gpu_layers', 'N/A')
            thr = c.get('threads', 'N/A')
            click.echo(f"  [{c.name}] model={model} gpu={gpu} threads={thr}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('logs')
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
@click.option("-f", "--follow", is_flag=True, default=False, help="Keep following the log file in real-time.")
def logs(port, follow):
    """Tail the log file for a running server."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        pm = ProcessManager()
        status = pm.status(port)
        if status.get('status') not in ('running', 'stale'):
            click.echo(f"No server found on port {port}.")
            return

        record = pm.list_servers().get(port, {})
        log_file = record.get('log_file')
        if not log_file:
            click.echo(f"No log file configured for server on port {port}.")
            return

        logfile = Path(log_file)
        if not logfile.exists():
            click.echo(f"Log file not found at {log_file}.")
            return

        if follow:
            click.echo(f"Tailing log file: {log_file} (Ctrl+C to stop)")
            subprocess.run(['tail', '-f', str(logfile)])
        else:
            with open(logfile, 'r') as f:
                content = f.read()
            if content:
                click.echo(content)
            else:
                click.echo(f"Log file {log_file} is empty.")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.command('server-metrics')
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
def server_metrics(port):
    """Fetch live metrics from a running llama.cpp server."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        pm = ProcessManager()
        status = pm.status(port)
        if status.get('status') != 'running':
            click.echo(f"Server is not running on port {port}.")
            return

        base_url = f"http://127.0.0.1:{port}"
        metrics_url = f"{base_url}/metrics"
        health_url = f"{base_url}/health"

        def fetch_json(url):
            req = urllib.request.Request(url, headers={'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read().decode())

        click.echo(f"Server Metrics for port {port}:")
        click.echo("=" * 50)

        try:
            health = fetch_json(health_url)
            click.echo("\nHealth:")
            for k, v in health.items():
                click.echo(f"  {k}: {v}")
        except Exception as e:
            click.echo(f"\nCould not fetch /health: {e}")

        try:
            metrics = fetch_json(metrics_url)
            click.echo("\nMetrics:")
            if 'prompt_timings' in metrics or 'eval_count' in metrics:
                eval_count = metrics.get('eval_count', 0)
                prompt_tokens = metrics.get('prompt_n', 0)
                decode_tokens = metrics.get('decoded_n', 0) or (eval_count - prompt_tokens if isinstance(eval_count, int) else 0)
                click.echo(f"  Total eval tokens: {eval_count}")
                click.echo(f"  Prompt tokens: {prompt_tokens}")
                click.echo(f"  Decode tokens: {decode_tokens}")
            if 'timings' in metrics and isinstance(metrics['timings'], dict):
                timings = metrics['timings']
                for tk in ('prompt_n', 'prompt_ms', 'prompt_per_second',
                           'total_token_count', 'eval_count', 'eval_duration'):
                    if tk in timings:
                        click.echo(f"  {tk}: {timings[tk]}")
            else:
                for k, v in metrics.items():
                    if not isinstance(v, (dict, list)):
                        click.echo(f"  {k}: {v}")

        except Exception as e:
            click.echo(f"\nCould not fetch /metrics: {e}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@cli.group()
def daemon():
    """Daemon management for auto-launching models at system startup."""
    pass


@daemon.command('start')
@click.option("--name", type=str, default="default", help="Config profile name.")
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
def daemon_start(name, port):
    """Start auto-launch daemon with systemd service generation."""
    try:
        config = load_config()
        model_path = getattr(config, 'default_model_path', None)
        port = port or getattr(config, 'server_port', 12345)

        exec_cmd = f"llama-launcher run --name {name} --port {port}"
        if model_path:
            exec_cmd = f"llama-launcher run --model '{model_path}' --port {port}"

        service_content = generate_systemd_service(
            service_name=f"llama-daemon-{name}",
            description=f"Llama launcher daemon for profile '{name}'",
            exec_start=exec_cmd,
            user=os.environ.get('USER', 'root'),
        )

        service_path = Path("/tmp/llama-daemon.service")
        with open(service_path, 'w') as f:
            f.write(service_content)

        click.echo(f"Systemd service written to: {service_path}")
        click.echo("\nTo install and enable the daemon:")
        click.echo(f"  sudo cp {service_path} /etc/systemd/system/llama-daemon-{name}.service")
        click.echo(f"  sudo systemctl daemon-reload")
        click.echo(f"  sudo systemctl enable llama-daemon-{name}")
        click.echo(f"  sudo systemctl start llama-daemon-{name}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@daemon.command('stop')
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
def daemon_stop(port):
    """Stop the running daemon server."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        pm = ProcessManager()
        result = pm.stop_server(port)
        click.echo(f"Server on port {port}: {result['status']}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


@daemon.command('status')
@click.option("--port", "-P", type=int, default=None, help="Server port (default: from config or 12345).")
def daemon_status(port):
    """Check daemon status."""
    try:
        config = load_config()
        port = port or getattr(config, 'server_port', 12345)
        pm = ProcessManager()
        status = pm.status(port)
        if status.get('status') == 'running':
            click.echo(f"Daemon server running on port {port} (PID {status['pid']})")
            if status.get('model'):
                click.echo(f"  Model: {Path(status['model']).name}")
            if status.get('started_at'):
                click.echo(f"  Started at: {status['started_at']}")
        else:
            click.echo(f"No daemon running on port {port}.")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)


if __name__ == '__main__':
    cli()
