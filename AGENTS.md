# llama-launcher — Knowledge Base

**Generated:** 2026-04-22
**Commit:** 2260217
**Branch:** main

## OVERVIEW
Launch and manage llama.cpp inference servers (GGUF models) via CLI + React dashboard. Python backend (click CLI, Pydantic config, stdlib logging) + React frontend (Vite 6, React Router v6 lazy routes, React Query, sonner toasts, Tailwind CSS). Server defaults to port **12345**.

Read the SOUL.md to initialize agents.

## STRUCTURE
```
llama-launcher/
├── backend/          # 🔑 Python backend (14 .py modules)
│   ├── cli.py        # Click CLI group, 15+ subcommands
│   ├── config.py     # Pydantic LlamaConfig — tri-source loading
│   ├── model_manager.py  # Auto-detect GGUF + HF search
│   ├── llama_runner.py   # CLI arg builder + subprocess exec
│   ├── process_manager.py# PID files, start/stop/status
│   ├── daemon.py       # Systemd service generator
│   ├── download.py     # HF model download helpers
│   ├── benchmark.py    # Parse output, build benchmark commands
│   ├── context.py      # Click context helper — resolve model, execute
│   ├── config_store.py # Save/load named configs (JSON files)
│   ├── logger.py       # stdlib logging: 3 verbosity levels, JSON formatter
│   ├── exceptions.py   # Exception hierarchy
│   ├── model_cards.py  # Parse HF model card YAML frontmatter
│   └── __init__.py     # Deferred imports, __all__ exports
├── ui/               # React/TypeScript frontend (Vite 6)
│   ├── src/modules/  # 6 page components (lazy-loaded)
│   ├── src/services/ # API, WS, error clients
│   ├── src/components/ # Shared: common, tables, forms, charts
│   ├── src/app/      # Router shell, ErrorBoundary wrapper
│   └── src/styles/   # Tailwind CSS vars (dark/light class-based)
├── tests/            # 7 unittest.TestCase files + Playwright E2E
├── prompts/          # AI planning documents
├── config.yaml       # Runtime defaults
├── pyproject.toml    # Build, entry point, deps
├── SOUL.md           # Agent OS (must load first)
├── PROGRESS.md       # Dev progress log
└── .config/          # IDE MCP servers
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add CLI command | `backend/cli.py` | Click group, 15+ subcommands, -v/-vv flags |
| Change model/config | `backend/config.py` | LlamaConfig Pydantic model, tri-source |
| Model detection | `backend/model_manager.py` | autodetect_local_models + HfApi search |
| Spawn llama.cpp | `backend/llama_runner.py` | generate_command, _ATTR_MAP, run_model |
| PID/process mgmt | `backend/process_manager.py` | start_server, stop_server, status |
| Daemon/systemd | `backend/daemon.py` | generate_systemd_service, start/stop daemon |
| Frontend pages | `ui/src/modules/` | DashboardPage, ServersPage, SettingsPage, DaemonPage, ServerDetailPage |
| API/WS clients | `ui/src/services/` | apiService, wsService (exponential backoff), errorService |
| Shared UI | `ui/src/components/common/` | Sidebar, TopBar, Breadcrumb, ErrorBoundary |
| Add test | `tests/` | unittest.TestCase (not pytest despite pyproject.toml listing) |
| AI plans | `prompts/` | Planning documents and cleanup tasks |

## CODE MAP (Key Symbols)
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `cli()` | function | `backend/cli.py` | Click group, 15+ subcommands |
| `LlamaConfig` | class | `backend/config.py` | Pydantic model, tri-source loading |
| `ModelManager` | class | `backend/model_manager.py` | autodetect_local_models, search_huggingface, run_benchmark |
| `LlamaRunner` | class | `backend/llama_runner.py` | generate_command, run_model_sync/async/mock |
| `ProcessManager` | class | `backend/process_manager.py` | start/stop/status_server, list_servers, PID_DIR |
| `App` | component | `ui/src/app/App.tsx` | Router shell, lazy routes, ErrorBoundary per route |
| `Daemon` | class | `backend/daemon.py` | Thread-based daemon, reload event |
| `ConfigStore` | class | `backend/config_store.py` | Named config persistence, CONFIGS_DIR |

## CONVENTIONS
- **Config priority:** CLI args > env vars > `config.yaml` > hardcoded defaults
- **Logging:** stdlib `logging` (NOT structlog) — 3 verbosity levels (0=errors, 1=info, 2=debug), JSON formatter
- **Exception hierarchy:** LlamaLauncherError → ConfigurationError, TransientProcessError, PermanentExecutionError
- **Python:** 3.10+, type hints, Pydantic for config validation
- **UI:** React Router v6 with lazy-loaded routes + `Loader2` spinner
- **Error boundaries:** Each route individually wrapped in `<ErrorBoundary>`
- **Path aliases:** 8 aliases (`@components`, `@modules`, `@services`, `@state`, `@utils`, `@hooks`, `@styles`, `@`)
- **Dark mode:** class-based (`darkMode: 'class'` in Tailwind)
- **Toast notifications:** use `sonner` (not `react-hot-toast`)
- **React Query:** staleTime=60s, retry=2
- **Process management:** PID files in `~/.llama_launcher/pids/`, configs in `~/.llama_launcher/configs/`
- **LLM attribute naming:** Python `temperature` → CLI `temp` (mapped in `_ATTR_MAP`)
- **Executable discovery:** llama-server → llama-cli → llama.cpp/main → main → llama_cpp_server
- **Tests:** All test files use `unittest.TestCase` despite `pyproject.toml` listing pytest; E2E via Playwright
- **WS reconnect:** exponential backoff, baseDelay=1s, maxRetries=10, cap=30s
- **ESLint:** `no-explicit-any`=warn, `no-unused-vars`=error (`_` prefix allowed)
- **Prettier:** semi=true, singleQuote=false, trailingComma=all, printWidth=100, arrowParens=always
- **TypeScript:** strict, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch

## ANTI-PATTERNS
- **`requirements.txt` is out of sync** with `pyproject.toml` — use `pyproject.toml` as source of truth
- **`ui/dist/` committed to git** — should be in `.gitignore`
- **`.history/`, `.omc/`, `.sisyphus/`** — AI IDE artifacts, do not edit
- **`{app,modules/`** — broken directory name with literal curly braces (artifact in `ui/src/`)
- **Config tri-source** — never hardcode values; all runtime config flows through `LlamaConfig`
- **Port config** — server port from `config.yaml` (`server_port`), not hardcoded
- **`structlog` in requirements.txt but unused** — code uses stdlib `logging` exclusively
- **`react-hot-toast` claimed in docs but code uses `sonner`** — documentation drift
- **Test framework inconsistency** — pyproject.toml lists pytest, but all tests use unittest
- **Config path mismatch** — `config.yaml` includes `~/models` in search paths but Python defaults don't

## COMMANDS
```bash
# Install
pip install -e .

# Run CLI
llama-launcher run --model-path ./models

# Run tests
pytest tests/

# Frontend dev server
cd ui && npm run dev

# Frontend build
cd ui && npm run build

# Frontend tests
cd ui && npm run test

# E2E tests
cd ui && npm run test:e2e
```

## NOTES
- Entry point defined in `pyproject.toml`: `llama-launcher = "backend.cli:cli"`
- Model search paths configured in `config.yaml` (`model_search_paths`)
- GPU acceleration controlled by `n_gpu_layers` in config (set to -1 for all layers)
- `llama-launcher` wrapper (no extension) is a raw artifact
- `SOUL.md` at project root must be loaded at start of every AI task session
