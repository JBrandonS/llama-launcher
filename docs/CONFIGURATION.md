# Configuration

## Tri-Source Loading

Config is loaded from three sources in order of priority (highest first):

1. **CLI arguments** — `--model`, `--temp`, `--n_ctx`, `--log-level`
2. **Environment variables** — `LLAMA_LAUNCHER_N_CTX`, `LLAMA_LAUNCHER_TEMPERATURE`, `LLAMA_LAUNCHER_HF_TOKEN`
3. **YAML config** — `config.yaml`
4. **Hardcoded defaults** — defined in `LlamaConfig` class

```python
config = load_config()  # Merges all sources
```

## config.yaml

Default configuration file. Example:

```yaml
# Core Settings
working_directory: "~/.cache/llama-launcher/models"

# Llama.cpp Runtime Options
default_options:
  n_ctx: 2048
  n_gpu_layers: -1
  temp: 0.7
  top_k: 40
  top_p: 0.9
  n_predict: 512
  threads: 8

# Model Search/Detection Settings
local_model_search_paths:
  - "~/.cache/llama.cpp/models"
  - "~/.cache/huggingface/hub"
  - "~/models"

# Server port for background servers, metrics, and status checks
server_port: 12345

# Hugging Face search parameters
default_hf_search_query: "llama 7b"
```

## LlamaConfig Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `default_model_path` | Path | `~/.cache/llama-launcher/default_model.gguf` | Default model to run |
| `working_directory` | Path | `~/.cache/llama-launcher/models` | Working directory |
| `local_model_search_paths` | List[Path] | See above | Paths to scan for GGUF files |
| `hf_api_key` | str | None | HuggingFace API key |
| `server_port` | int | 12345 | Server port (1-65535) |
| `n_ctx` | int | 2048 | Context window size |
| `n_gpu_layers` | int | -1 | GPU layers (-1 = all) |
| `temperature` | float | 0.7 | Sampling temperature |
| `top_k` | int | 40 | Top-k sampling |
| `top_p` | float | 0.9 | Top-p (nucleus) sampling |
| `n_predict` | int | 512 | Max tokens to predict |
| `threads` | int | 8 | Thread count |
| `log_level` | str | "INFO" | Logging level |

## Named Configs

Save and load named configuration profiles:

```bash
# Save a config
llama-launcher save-config my-model --model ./models/model.gguf --n-gpu-layers 32 --threads 8

# List configs
llama-launcher list-configs

# Load and display a config
llama-launcher load-config my-model
```

Config files are stored in `~/.llama_launcher/configs/` as JSON.

## Logging

3 verbosity levels controlled by CLI flags:

| Flag | Level | Behavior |
|------|-------|----------|
| (none) | 0 | Errors only → stderr |
| `-v` | 1 | Info → stdout, warnings → stderr |
| `-vv` | 2 | Debug → detailed logging |

Logger name: `'llama_launcher'`

JSON formatter is used for structured log output.
