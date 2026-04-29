# Deployment

## Systemd Daemon

Generate and install a systemd service for auto-launching models at boot:

```bash
# Generate service file
llama-launcher daemon start --name default --port 12345

# Install and enable
sudo cp /tmp/llama-daemon.service /etc/systemd/system/llama-daemon-default.service
sudo systemctl daemon-reload
sudo systemctl enable llama-daemon-default
sudo systemctl start llama-daemon-default

# Check status
sudo systemctl status llama-daemon-default
```

## Installation

### From Source

```bash
git clone https://github.com/username/llama-launcher.git
cd llama-launcher
pip install -e .
```

### From PyPI (future)

```bash
pip install llama-launcher
```

## Dependencies

### Python

| Dependency | Version | Purpose |
|------------|---------|---------|
| `click` | >=8.0 | CLI framework |
| `pydantic` | >=2.0 | Config validation |
| `pywebview` | >=5.0 | Desktop UI window |
| `pyyaml` | >=6.0 | YAML config parsing |
| `huggingface-hub` | >=0.20 | HF model download/search |

### Frontend

| Dependency | Version | Purpose |
|------------|---------|---------|
| `vite` | 6 | Build tool |
| `react` | latest | UI framework |
| `react-router` | v6 | Routing |
| `@tanstack/react-query` | latest | Data fetching |
| `sonner` | latest | Toast notifications |
| `tailwindcss` | latest | Styling |

## External Dependencies

- **llama.cpp**: The `llama-server` binary must be in PATH or in one of the standard locations:
  - `llama-server`
  - `llama-cli`
  - `llama.cpp/main`
  - `main`
  - `llama_cpp_server`

## User Directories

| Path | Purpose |
|------|---------|
| `~/.llama_launcher/pids/` | PID files for running servers |
| `~/.llama_launcher/configs/` | Named configuration profiles |
| `~/.cache/llama-launcher/models/` | Default working directory |
| `~/.cache/llama.cpp/models/` | Model search path |
| `~/.cache/huggingface/hub` | Model search path |
| `~/models` | Model search path |

## Frontend Build

```bash
cd ui && npm install && npm run build
```

The built static assets go to `ui/dist/`. Serve via `python -m ui.launcher` or any static file server.
