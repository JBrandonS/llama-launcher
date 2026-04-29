# API Reference

## REST Endpoints (llama.cpp Server)

The llama.cpp server exposes these endpoints on the configured port (default 12345).

### Health Check

```
GET /health
```

Returns JSON with server health status:

```json
{
  "status": "ok"
}
```

### Metrics

```
GET /metrics
```

Returns JSON with performance metrics:

```json
{
  "timings": {
    "prompt_n": 10,
    "prompt_ms": 123.45,
    "prompt_per_second": 81.0,
    "total_token_count": 512,
    "eval_count": 502,
    "eval_duration": 1234567.0
  },
  "eval_count": 502,
  "prompt_n": 10,
  "decoded_n": 492
}
```

## CLI API

The CLI is the primary interface. All commands are grouped under `llama-launcher`.

### Entry Point

```python
from backend.cli import cli
```

### Config Loading

```python
from backend.config import load_config, LlamaConfig

config = load_config()  # Loads from config.yaml + env + CLI args
config.server_port      # int, default 12345
config.temperature      # float, default 0.7
config.n_gpu_layers     # int, default -1 (all layers)
```

### Model Detection

```python
from backend.model_manager import ModelManager

manager = ModelManager(config)
models = manager.autodetect_local_models()  # List[Dict[str, Any]]
results = manager.search_huggingface_sync("llama 7b", limit=10)
```

### Process Management

```python
from backend.process_manager import ProcessManager

pm = ProcessManager()
result = pm.start_server(model_path, port=12345, n_ctx=2048, n_gpu_layers=-1, threads=8, temp=0.7)
status = pm.status(port=12345)  # {'status': 'running', 'pid': 12345, ...}
pm.stop_server(port=12345)
servers = pm.list_servers()  # Dict[port, info]
```

### Model Execution

```python
from backend.llama_runner import LlamaRunner

runner = LlamaRunner(config)
output = runner.run_model_sync(model_path, prompt, options=None)
# or async:
# output = await runner.run_model_async(model_path, prompt)
```

### Named Configs

```python
from backend.config_store import ConfigStore, ConfigItem

store = ConfigStore()
store.save("my-config", {'default_model_path': '/path/to/model.gguf', 'n_gpu_layers': 32})
config = store.load("my-config")
configs = store.list_configs()
```

### Logging

```python
from backend.logger import get_logger

logger = get_logger(__name__)
logger.info("message")
logger.warning("message")
logger.error("message", extra_data={"key": "value"})
```

### Exceptions

```python
from backend.exceptions import (
    LlamaLauncherError,
    ConfigurationError,
    TransientProcessError,
    PermanentExecutionError,
)
```
