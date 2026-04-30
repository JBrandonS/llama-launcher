# llama-launcher

Launch and manage llama.cpp inference servers (GGUF models) via CLI + React dashboard.

## What It Does

- **Launch** llama.cpp servers from the CLI or a web dashboard
- **Manage** running servers (start, stop, status, metrics)
- **Discover** GGUF models locally and on HuggingFace
- **Benchmark** models head-to-head
- **Auto-start** servers at boot via systemd daemon

Server defaults to port **12345**.

## Quick Start

```bash
pip install -e .
llama-launcher run --model-path ./models/model.gguf
```

Or open the web dashboard at `http://127.0.0.1:12345`.

## Commands

```bash
llama-launcher run          # Launch a model server
llama-launcher list-models  # List local GGUF models
llama-launcher search "x"   # Search HuggingFace
llama-launcher download id  # Download from HuggingFace
llama-launcher ps           # List running servers
llama-launcher stop -P 12345 # Stop a server
llama-launcher benchmark    # Benchmark models
llama-launcher daemon start # Generate systemd service
```

## Architecture

- **Backend**: Python (Click CLI, Pydantic config, FastAPI, psutil)
- **Frontend**: React/TypeScript (Vite 6, React Router, Tailwind CSS)
- **Config**: `config.yaml` > env vars > CLI args > defaults

## How This Exists

This project was **vibe-coded** as a proof-of-concept test. Most (but not all) prompts used can be found in the `prompts/` folder.

It was built using local LLMs, primarily **Qwen 3.6**, inside **OpenCode** with **oh-my-opencode-slim**.

## ⚠️ Security Warning

**Only an absolute fool would consider this project secure in any way.**

- No authentication by default
- No TLS/HTTPS
- No input sanitization
- No rate limiting
- No network isolation

Do NOT run this on any network you trust with sensitive data. This is a development tool, not a production system.

## License

MIT — use at your own risk.
