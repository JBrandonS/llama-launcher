# Contributing

## Getting Started

```bash
# Install
pip install -e .

# Install dev dependencies
pip install -e ".[dev]"

# Run tests
python -m pytest tests/ -v

# Run frontend dev server
cd ui && npm run dev
```

## Code Structure

```
llama-launcher/
├── backend/          # Python backend (14 .py modules)
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
└── docs/             # This directory
```

## Conventions

### Python

- **Type hints**: All functions and classes must be typed
- **Config**: Never hardcode values — use `LlamaConfig` tri-source loading
- **Logging**: stdlib `logging` only (NOT structlog). 3 verbosity levels:
  - 0 = errors only (stderr)
  - 1 = info (stdout) + warnings (stderr)
  - 2 = debug (detailed)
- **Exceptions**: Always raise specific subclass:
  - `ConfigurationError` — config loading/parsing failures
  - `TransientProcessError` — external subprocess errors (retryable)
  - `PermanentExecutionError` — fatal errors (not retryable)
- **No `structlog`**: Use stdlib `logging` exclusively

### Frontend

- **React Router v6**: Lazy-loaded routes with `Loader2` spinner
- **Error boundaries**: Each route individually wrapped
- **Toast notifications**: Use `sonner` (NOT `react-hot-toast`)
- **React Query**: `staleTime=60s`, `retry=2`
- **Dark mode**: Class-based (`darkMode: 'class'` in Tailwind)
- **Path aliases**: 8 aliases (`@components`, `@modules`, `@services`, `@state`, `@utils`, `@hooks`, `@styles`, `@`)

### Testing

- All tests use `unittest.TestCase` (NOT pytest despite `pyproject.toml` listing it)
- E2E tests use Playwright
- Run `python -m pytest tests/ -v` to execute all tests

### Git

- **Branch-per-Task**: Descriptive branch names (`feat/xxx`, `fix/xxx`)
- **Atomic Commits**: Conventional commit format (`feat:`, `fix:`, `refactor:`)
- **Pre-Commit Validation**: Run diagnostics and tests before committing

## Anti-Patterns (Avoid)

- **`requirements.txt` out of sync**: Use `pyproject.toml` as source of truth
- **`ui/dist/` committed**: Should be in `.gitignore`
- **`.history/`, `.omc/`, `.sisyphus/`**: AI IDE artifacts, do not edit
- **Hardcoded port**: Always use `config.server_port`
- **Hardcoded model paths**: Use `LlamaConfig.default_model_path` or search paths
- **Direct subprocess calls**: Always go through `LlamaRunner.generate_command()`
- **Bare `Exception` catches**: Catch specific subclasses when handling
- **Batch operations on models**: Benchmark uses semaphore throttling (4 concurrent)
- **`config.yaml` in git**: Runtime config is gitignored
- **Type error suppression**: Never use `as any`, `@ts-ignore`, `@ts-expect-error`
- **Empty catch blocks**: Never suppress exceptions silently

## Adding a CLI Command

1. Add `@cli.command()` decorator in `backend/cli.py`
2. Accept `-v`/`-vv` via the Click group context
3. Use `load_config()` for configuration
4. Use `ProcessManager`, `ModelManager`, `LlamaRunner` as needed
5. Wrap in try/except, output to `click.echo(..., err=True)` on error

## Adding a Config Field

1. Add field to `LlamaConfig` class in `backend/config.py`
2. Add default in `config.yaml`
3. Add env var override in `load_config()` if appropriate
4. Document in `docs/CONFIGURATION.md`
