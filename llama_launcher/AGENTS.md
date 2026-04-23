# llama_launcher — Module Knowledge Base

**Parent:** ../AGENTS.md
**Commit:** 2260217
**Branch:** main

## MODULE SCOPE
Python backend package — CLI interface, config management, model detection, process management, daemon. 14 `.py` modules. No external subdirectories.

## MODULE STRUCTURE
```
llama_launcher/
├── cli.py            # Click CLI group, 15+ subcommands
├── config.py         # Pydantic LlamaConfig, tri-source loading
├── model_manager.py  # ModelRegistry + ModelManager (GGUF + HfApi)
├── llama_runner.py   # CLI arg builder, subprocess execution
├── process_manager.py# PID files, start/stop/status
├── daemon.py         # Thread-based daemon, systemd generator
├── download.py       # HuggingFace snapshot download helpers
├── benchmark.py      # Parse benchmark output, build benchmark commands
├── context.py        # Click context helper — resolve model, execute
├── config_store.py   # Named config persistence (JSON files)
├── logger.py         # stdlib logging: 3 verbosity levels, JSON formatter
├── exceptions.py     # Exception hierarchy
├── model_cards.py    # Parse HF model card YAML frontmatter
└── __init__.py       # Deferred imports, __all__ exports
```

## KEY SYMBOLS
| Symbol | Type | File | Role |
|--------|------|------|------|
| `cli()` | function | cli.py | Click group entry point, 15+ subcommands |
| `run()` | function | cli.py | Main run subcommand |
| `list_models()` | function | cli.py | List local models, interactive selection |
| `search()` | function | cli.py | HuggingFace model search |
| `download()` | function | cli.py | Download model from HF |
| `ps()` | function | cli.py | List running servers |
| `server_status()` | function | cli.py | Health check for port |
| `stop()` | function | cli.py | Stop server on port |
| `arena()` | function | cli.py | Run arena battle |
| `save_config()` | function | cli.py | Save named config |
| `load_config_cmd()` | function | cli.py | Load named config |
| `list_configs()` | function | cli.py | List saved configs |
| `logs()` | function | cli.py | Tail server logs |
| `server_metrics()` | function | cli.py | Fetch server metrics |
| `daemon_start()` | function | cli.py | Start systemd daemon |
| `daemon_stop()` | function | cli.py | Stop daemon |
| `daemon_status()` | function | cli.py | Daemon status |
| `LlamaConfig` | class | config.py | Pydantic model, tri-source (CLI > env > YAML > defaults) |
| `load_config()` | function | config.py | Main config loader |
| `ModelManager` | class | model_manager.py | autodetect_local_models, search_huggingface, run_benchmark |
| `ModelRegistry` | class | model_manager.py | ID→path mapping, register/list_all/clear |
| `scan_local_models()` | function | model_manager.py | Walk paths for GGUF files |
| `download_model()` | function | model_manager.py | HF snapshot_download wrapper |
| `LlamaRunner` | class | llama_runner.py | generate_command, run_model, run_model_sync/async/mock |
| `PID_DIR` | constant | process_manager.py | Path.home() / '.llama_launcher' / 'pids' |
| `ProcessManager` | class | process_manager.py | start_server, stop_server, status, list_servers |
| `Daemon` | class | daemon.py | Thread-based daemon, start/stop/reload |
| `generate_systemd_service()` | function | daemon.py | Generate systemd unit file |
| `setup_logger()` | function | logger.py | stdlib logging, 3 verbosity levels |
| `PatchedLogger` | class | logger.py | extra_data() support |
| `StructuredJSONFormatter` | class | logger.py | JSON log output |
| `_DynamicStreamHandler` | class | logger.py | stdout/stderr routing by level |
| `ConfigStore` | class | config_store.py | Named config persistence |
| `CONFIGS_DIR` | constant | config_store.py | Path.home() / '.llama_launcher' / 'configs' |
| `ConfigItem` | class | config_store.py | Named config data class |
| `Context` | class | context.py | Resolve model → execute pipeline |
| `get_context()` | function | context.py | Factory for Context with model_manager |
| `parse_benchmark_output()` | function | benchmark.py | Parse tokens, TPS, latency from output |
| `run_benchmark()` | function | benchmark.py | Execute benchmark, collect metrics |
| `_ATTR_MAP` | constant | llama_runner.py | Python→CLI arg mapping (temperature→temp, etc.) |
| `LlamaLauncherError` | class | exceptions.py | Base exception |
| `ConfigurationError` | class | exceptions.py | Config loading/parsing failures |
| `TransientProcessError` | class | exceptions.py | External subprocess errors (retryable) |
| `PermanentExecutionError` | class | exceptions.py | Fatal errors (not retryable) |
| `parse_model_card()` | function | model_cards.py | Parse HF model card YAML frontmatter |
| `get_recommended_params()` | function | model_cards.py | Extract recommended CLI flags |

## CONVENTIONS
- **CLI:** Click group with `-v`/`-vv` verbosity flags; all subcommands accept `--config` flag
- **Config flow:** `load_config()` → `LlamaConfig` → used by all modules
- **Model resolution:** name → local path match → HF search → interactive prompt
- **Process mgmt:** PID files in `~/.llama_launcher/pids/` (JSON format), default port 12345
- **Logging:** `_VERBOSITY` levels (0=errors-only stderr, 1=info stdout+warning stderr, 2=debug detailed)
- **Path expansion:** `~` → `Path.home()` via `_expand_path()` in config.py
- **Exception types:** Always raise specific subclass (ConfigurationError, TransientProcessError, PermanentExecutionError)
- **No `structlog`:** Use stdlib `logging` exclusively
- **Executable discovery:** Check PATH for llama-server → llama-cli → llama.cpp/main → main → llama_cpp_server

## ANTI-PATTERNS
- **Never hardcode port** — always use `config.server_port`
- **Never hardcode model paths** — use `LlamaConfig.default_model_path` or search paths
- **Never use `structlog`** — code uses stdlib `logging`
- **Never catch bare `Exception`** — catch specific subclasses when handling
- **No batch operations on models** — benchmark uses semaphore throttling (4 concurrent)
- **No `config.yaml` in git** — runtime config is gitignored
- **No direct subprocess calls** — always go through `LlamaRunner.generate_command()` + subprocess

## DEPENDENCIES
| Dependency | Module | Usage |
|------------|--------|-------|
| `click` | cli.py | CLI framework |
| `pydantic` | config.py, config_store.py | Config validation |
| `huggingface_hub` | model_manager.py, download.py, model_cards.py | HF API, snapshot_download |
| `logging` (stdlib) | logger.py | All logging |
| `subprocess` (stdlib) | llama_runner.py, benchmark.py | Process execution |
| `json`, `pathlib`, `sys`, `os` | various | Standard library utilities |
| `threading` | daemon.py | Thread-based daemon |
| `asyncio` | llama_runner.py, model_manager.py | Async execution, semaphore |
| `httpx` | cli.py (server_metrics) | HTTP requests for metrics |

## COMMANDS
```bash
# Run server
llama-launcher run --model-path ./model.gguf

# Search HuggingFace
llama-launcher search "llama 7b"

# Download model
llama-launcher download <hf-repo-id>

# List models
llama-launcher list-models [--names-only]

# Save config
llama-launcher save-config my-config --model ./model.gguf --gpu-layers 32

# List saved configs
llama-launcher list-configs

# Run benchmark
llama-launcher benchmark

# System daemon
llama-launcher daemon start [--port 12345]
llama-launcher daemon stop [--port 12345]
llama-launcher daemon status [--port 12345]
```
