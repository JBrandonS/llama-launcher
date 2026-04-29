# CLI Reference

## Usage

```bash
llama-launcher [OPTIONS] COMMAND [ARGS]...
```

### Global Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show info messages |
| `-vv, --debug` | Show detailed debug logging |

## Commands

### `run`

Run a model interactively or in the background.

```bash
llama-launcher run [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--model PATH` | Path to GGUF model file |
| `--name NAME` | Named model from detected models |
| `--prompt TEXT` | Initial prompt text |
| `--options TEXT` | Comma-separated key=value options (e.g. `temp=0.8,n_ctx=2048`) |
| `-F, --foreground` | Run in foreground (opposite of default background) |
| `-P, --port INT` | Port for server (default: from config or 12345) |
| `--threads INT` | Override thread count |

### `list-models`

List local models and optionally search HuggingFace.

```bash
llama-launcher list-models [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--hf-query TEXT` | HuggingFace search query |
| `--names-only` | Show only model names (one per line) |

### `search`

Search HuggingFace for llama.cpp GGUF models.

```bash
llama-launcher search [QUERY]
```

### `download`

Download a GGUF model from HuggingFace.

```bash
llama-launcher download MODEL_ID [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `MODEL_ID` | HuggingFace model ID (e.g. `organization/model-name`) |
| `--dir PATH` | Destination directory |

### `model-cards`

Display a HuggingFace model card for recommended settings.

```bash
llama-launcher model-cards MODEL_ID
```

### `ps`

List running llama.cpp servers.

```bash
llama-launcher ps [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON |

### `server-status`

Check status of a background server.

```bash
llama-launcher server-status [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-P, --port INT` | Server port (default: from config or 12345) |

### `stop`

Stop a background server.

```bash
llama-launcher stop [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-P, --port INT` | Server port (default: from config or 12345) |

### `arena`

Benchmark multiple models head-to-head.

```bash
llama-launcher arena
```

### `save-config`

Save a named configuration profile.

```bash
llama-launcher save-config [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--name TEXT` | Config name (default: `default`) |
| `--model PATH` | Default model path |
| `--n-gpu-layers INT` | GPU layers |
| `--threads INT` | Thread count |
| `-f, --force` | Overwrite existing config |

### `load-config`

Display a saved configuration profile.

```bash
llama-launcher load-config [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--name TEXT` | Config name to display (default: `default`) |

### `list-configs`

List all saved configuration profiles.

```bash
llama-launcher list-configs
```

### `logs`

Tail the log file for a running server.

```bash
llama-launcher logs [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-P, --port INT` | Server port (default: from config or 12345) |
| `-f, --follow` | Keep following the log file in real-time |

### `server-metrics`

Fetch live metrics from a running llama.cpp server.

```bash
llama-launcher server-metrics [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-P, --port INT` | Server port (default: from config or 12345) |

### `daemon`

Daemon management for auto-launching models at system startup.

```bash
llama-launcher daemon [OPTIONS] SUBCOMMAND [OPTIONS]
```

#### `daemon start`

Start auto-launch daemon with systemd service generation.

```bash
llama-launcher daemon start [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--name TEXT` | Config profile name (default: `default`) |
| `-P, --port INT` | Server port |

#### `daemon stop`

Stop the running daemon server.

```bash
llama-launcher daemon stop [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-P, --port INT` | Server port |

#### `daemon status`

Check daemon status.

```bash
llama-launcher daemon status [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `-P, --port INT` | Server port |
