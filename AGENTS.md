# llama-launcher — Project Context

## What This Is
CLI tool for managing and running LLaMA.cpp GGUF models. Provides model discovery, downloading, configuration management, background serving, benchmarking, and monitoring.

## Stack
- Python 3.10+, Click for CLI, Pydantic v2 for config, PyYAML, huggingface-hub
- No async in cli.py — all HfApi calls go through `asyncio.run()` wrappers
- Build: `pip install -e .` (pyproject.toml + setuptools)
- Test: `pytest tests/`

## Directory Layout
```
llama_launcher/        # Package
  cli.py               # Click commands entry point
  config.py            # Pydantic LlamaConfig + YAML loader
  model_manager.py     # Local model scanning (GGUF), HF search
  llama_runner.py      # llama-server/llama-cli subprocess launcher
  process_manager.py   # PID files, start/stop/status for background servers
  download.py          # HuggingFace snapshot download
  benchmark.py         # Performance measurement via llama-cli
  daemon.py            # Systemd service file generation
  context.py           # Higher-level orchestrator (config + models)
  config_store.py      # Saved profiles (~/.llama_launcher/configs/)
  logger.py            # Human-readable logging, verbosity levels 0/1/2
  model_cards.py       # HF README.md parsing for recommended params
  exceptions.py        # Custom exceptions
tests/                 # pytest files (match test_*.py)
config.yaml           # Default settings (untracked per .gitignore)
llama-launcher         # Entrypoint script (wrapper around cli:cli)
pyproject.toml
```

## Key Defaults
- Server binary: `llama-server` (looked up via `shutil.which`)
- CLI binary: `llama-cli`
- Default port: 12345 (from config.yaml or LlamaConfig.server_port)
- Model search paths: `~/.cache/llama.cpp/models`, `~/.cache/huggingface/hub`, `~/models`
- PID directory: `~/.llama_launcher/pids/`
- Config profiles: `~/.llama_launcher/configs/`

## Logging
Verbosity controlled by `-v` / `-vv` flags on the group command.
- 0 (default): Errors only → stderr, format `[ERROR] message`
- 1 (`-v`): Info+ → stdout for info, stderr for warnings/errors, format `[INFO] message`
- 2 (`-vv`): Debug+ with timestamps and module names

## CLI Commands
| Command | Purpose |
|---|---|
| `run` | Launch model (background by default, `--foreground` for sync) |
| `list-models` | Show local models (`--names-only` for just IDs) |
| `search <query>` | Search HF for GGUF models |
| `download <id>` | Download a GGUF model from HF |
| `ps` | List running servers (`--json` for JSON output) |
| `server-status` | Check single server health |
| `server-metrics` | Fetch live token throughput metrics |
| `stop` | Stop a background server |
| `logs` | Tail server log file (`-f` to follow) |
| `arena` | Benchmark models head-to-head |
| `model-cards <id>` | Show HF README.md params for recommended settings |
| `save-config` / `load-config` / `list-configs` | Named config profiles |
| `daemon start/stop/status` | Systemd service generation and management |

## Rules
- Never suppress type errors with `as any` or `@ts-ignore` (N/A in Python, but: never use `type: ignore` to hide real errors)
- Port comes from config by default; CLI `--port` overrides
- All subprocess calls should handle FileNotFoundError gracefully
- Keep changes minimal and focused — one task per commit
