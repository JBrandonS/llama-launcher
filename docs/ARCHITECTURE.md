# Architecture

## Overview

llama-launcher is a CLI tool and desktop application for managing and running
llama.cpp inference servers. It consists of two independent layers:

- **Backend** — Python package (`backend/`) providing CLI (Click), config
  management (Pydantic), model detection (GGUF + HuggingFace), process
  management (PID files), and daemon support (systemd).
- **Frontend** — React/TypeScript SPA (`ui/`) served via Vite, with a desktop
  wrapper (`ui/launcher.py`) using pywebview.

The server defaults to port **12345**.

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      User Interface                      │
├──────────────┬──────────────────────────────────────────┤
│  CLI (Click) │  React SPA (Vite) → pywebview (desktop) │
│  `llama-     │  ui/src/ → ui/dist/ → launcher.py       │
│  launcher`   │                                          │
└──────┬───────┴──────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                     Python Backend                       │
├──────────┬──────────────┬──────────────┬────────────────┤
│ cli.py   │ config.py    │ model_mgr.py │ process_mgr.py │
│ 15+ cmds │ LlamaConfig  │ autodetect   │ PID files      │
│          │ tri-source   │ + HF search  │ start/stop     │
├──────────┼──────────────┼──────────────┼────────────────┤
│ llama_   │ daemon.py    │ benchmark.py │ download.py    │
│ runner.py│ systemd gen  │ parse + run  │ HF snapshot    │
├──────────┼──────────────┼──────────────┼────────────────┤
│ logger.py│ exceptions.py│ config_store │ model_cards.py │
│ 3 levels │ hierarchy    │ JSON store   │ HF frontmatter │
└──────────┴──────────────┴──────────────┴────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                   llama.cpp server                       │
│              (llama-server process on :12345)            │
└─────────────────────────────────────────────────────────┘
```

## Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `cli.py` | Click CLI group, 15+ subcommands |
| `config.py` | Pydantic `LlamaConfig`, tri-source loading (CLI > env > YAML > defaults) |
| `model_manager.py` | `ModelRegistry` + `ModelManager`, GGUF autodetect, HF search |
| `llama_runner.py` | CLI arg builder, subprocess execution |
| `process_manager.py` | PID file management, start/stop/status |
| `daemon.py` | Thread-based daemon, systemd service generator |
| `download.py` | HuggingFace snapshot download helpers |
| `benchmark.py` | Parse benchmark output, build benchmark commands |
| `context.py` | Click context helper — resolve model, execute |
| `config_store.py` | Named config persistence (JSON files) |
| `logger.py` | stdlib logging: 3 verbosity levels, JSON formatter |
| `exceptions.py` | Exception hierarchy |
| `model_cards.py` | Parse HF model card YAML frontmatter |
| `__init__.py` | Deferred imports, `__all__` exports |

## Data Flow

1. **Config Loading**: `load_config()` reads YAML → merges env vars → merges CLI args → validates with Pydantic
2. **Model Resolution**: name → local path match → HF search → interactive prompt
3. **Server Launch**: `ProcessManager.start_server()` → writes PID file → spawns `llama-server` subprocess
4. **Metrics**: HTTP GET `/metrics` and `/health` on the server port
5. **Daemon**: systemd service generation → `systemctl enable/start`

## Key Design Decisions

- **No `structlog`**: Use stdlib `logging` exclusively (3 verbosity levels)
- **PID files**: Stored in `~/.llama_launcher/pids/` as JSON
- **Config paths**: `~/.llama_launcher/configs/` for named configs
- **Port**: Always from `config.server_port`, never hardcoded
- **Executable discovery**: `llama-server` → `llama-cli` → `llama.cpp/main` → `main` → `llama_cpp_server`
- **WS reconnect**: Exponential backoff, baseDelay=1s, maxRetries=10, cap=30s
- **Benchmark**: Semaphore throttling (4 concurrent)
