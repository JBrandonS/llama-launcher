# GAINED_KNOWLEDGE.md

Lessons learned during llama-launcher development and maintenance.

## 2026-04-22: CLI Output Overhaul

### Problem Found
The `list-models` command was cluttered with scan path warnings for directories that don't exist on the user's system (e.g., `/home/b/.cache/llama.cpp/models`, `/home/b/models`). These warnings appeared even at default verbosity because `logger.warning()` was used inside `scan_local_models()`.

### Solution Applied
- Changed per-model registration logs to `logger.debug()` (only visible with `-vv`)
- Made missing scan path messages `logger.debug()` instead of `logger.warning()` 
- The scan paths should be user-configurable in config.yaml - if a path doesn't exist, it's expected behavior, not a warning
- Model listing now shows just model names by default; full details (path, size) available with verbose flags

### Logging Verbosity Levels
| Level | Flag | Behavior |
|-------|------|----------|
| Quiet (0) | Default (no flag) | Only errors to stderr |
| Basic (1) | `-v` | Warnings + info to stdout/stderr separately, clean format |
| Detailed (2) | `-vv` | Debug logging including per-model scan details |

### Key Architectural Insight
The `get_logger()` function in `logger.py` initializes a basic handler when called before `setup_logger()`. Modules like `config.py` and `context.py` call `get_logger(__name__)` at module load time, creating handlers before the CLI establishes proper formatting. The fix is to ensure `cli()` calls `setup_logger()` first, and all modules use the logger after setup or check if handlers exist before logging startup messages.
