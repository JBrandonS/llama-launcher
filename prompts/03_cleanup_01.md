# Plan 03 — Cleanup & Restructure

**Created:** 2026-04-28
**Status:** Complete

## Goal
Clean up stale artifacts, reorganize project structure, and fill in missing documentation.

## Tasks

### 1. Move `prompt` file into `prompts/` and create `03_cleanup_01.md`
- [x] Save current `prompt` content into `prompts/03_cleanup_01.md`
- [x] Rename `todos/` → `prompts/`
- [x] Update all references to `todos/` → `prompts/` (AGENTS.md, any configs)

### 2. Remove `cont` file
- [x] Delete root-level `cont` file (contains stale session reference)

### 3. Create `cleanup.sh` bash script
- [x] Script to remove old/leftover/AI artifacts:
  - `.history/` — AI undo history
  - `.omc/` — OhMyOpenCode state
  - `.sisyphus/` — Sisyphus agent state
  - `.ruff_cache/` — Ruff linter cache
  - `.pytest_cache/` — Pytest cache
  - `__pycache__/` — Python bytecode
  - `logs/` — runtime logs
  - `tools/` — unused ZERA prompt checkers
  - `*.log` — stray log files
  - `node_modules/` — npm cache (optional, with warning)
  - `ui/node_modules/` — frontend npm cache
  - `dist/`, `build/` — build artifacts
  - `*.pyc`, `*.pyo` — Python bytecode files
- [x] Make script executable
- [x] Script committed to git (not ignored — developer utility)

### 4. Remove `logs/` folder
- [x] Delete `logs/` directory (contains stale MCP tool logs) — was already empty/removed
- [x] Ensure `logs/` is in `.gitignore` (already present)

### 5. Remove `tools/` folder
- [x] Delete `tools/` directory (contains unused `prompt_check.py` and `prompt_quality.py`) — was already removed
- [x] Update `AGENTS.md` — remove `tools/` references (lines 37, 58) — already clean

### 6. Restructure `llama_launcher/` → `backend/`
- [x] Renamed `llama_launcher/` → `backend/`
- [x] Updated all imports: `llama_launcher.*` → `backend.*`
- [x] Updated pyproject.toml entry points
- [x] Updated AGENTS.md structure diagram
- [x] Updated test patches and module references
- [x] Verified: `llama-launcher --help` works

### 7. Fill out `docs/` folder
- [x] `docs/ARCHITECTURE.md` — System architecture overview
- [x] `docs/CONTRIBUTING.md` — How to contribute
- [x] `docs/CLI_REFERENCE.md` — CLI command reference
- [x] `docs/API.md` — API endpoints documentation
- [x] `docs/DEPLOYMENT.md` — Deployment guide (daemon, systemd)
- [x] `docs/CONFIGURATION.md` — Configuration options

## Files to Update
- `AGENTS.md` — Remove `tools/` references, update structure diagram
- `.gitignore` — Add `cleanup.sh` exclusion, verify all cleanup targets
- `todos/03_cleanup_01.md` → `prompts/03_cleanup_01.md`

## Notes
- `cont` file contains: `opencode -s ses_238dff822ffeuU67SEwmjrMHJn` (stale session ref)
- `tools/prompt_check.py` and `tools/prompt_quality.py` are unused ZERA framework checkers
- `logs/` contains 2 MCP tool log files from April 22
- `docs/` is currently empty
- `.gitignore` already covers `logs/`, `.history/`, `.omc/`, `.sisyphus/`
