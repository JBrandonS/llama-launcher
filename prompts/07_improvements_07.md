# Plan: Don't Emit Default CLI Arguments

## Problem
When launching a server, all CLI arguments are emitted even when they match the default values. This creates verbose commands and makes log debugging harder.

## Current State
- `backend/llama_runner.py` — `LlamaRunner.generate_command()` builds CLI args from config
- All non-null args are added to the command, regardless of whether they match defaults
- `backend/llama_runner.py` — `_clamp_n_predict` validates n_predict range
- `ui/src/modules/launch/LaunchPage.tsx` — `DEFAULT_FORM` defines default values for all form fields
- `ui/src/templates/llama-templates.json` — Templates define default args

## Implementation Plan

### 1. Define Default Values in Backend (`backend/llama_runner.py`)
Create a `DEFAULT_ARGS` dictionary matching the frontend defaults:

```python
DEFAULT_ARGS = {
    'gpu_layers': -1,
    'context_size': 0,
    'threads': 0,
    'temp': 0.8,
    'top_k': 40,
    'top_p': 0.95,
    'min_p': 0.05,
    'typical_p': 1.0,
    'penalty_range': 64,
    'repeat_penalty': 1.1,
    'repeat_last_n': 0,
    'presence_penalty': 0.0,
    'frequency_penalty': 0.0,
    'mirostat': 0,
    'mirostat_tau': 5.0,
    'mirostat_eta': 0.1,
    'seed': -1,
    'n_predict': 256,
    'num_keep': -1,
    'rope_freq_scale': 1.0,
    'grammar_file': '',
    'batch_size': 2048,
    'cache_reuse': 0,
    # New fields from improvement 07_improvements_06
    'host': '127.0.0.1',
    'cors': False,
    'flash_attn': False,
    'no_mmap': False,
    'mlock': False,
    'numa': False,
    'cont_batching': False,
    'rope_scaling': 'none',
    'rope_freq_base': 1000000,
    'embedding': False,
    'logits_all': False,
    'speculative': False,
    'draft_model': '',
    'prompt_cache': '',
    'keep_live': 0,
}
```

### 2. Modify generate_command() (`backend/llama_runner.py`)
Update `LlamaRunner.generate_command()` to skip default values:

```python
def generate_command(self, config: Dict[str, Any]) -> List[str]:
    cmd = [self._find_llama_server()]
    
    # Model and port (always required)
    cmd.extend(['--model', str(config.get('model', ''))])
    cmd.extend(['--port', str(config.get('port', 8080))])
    
    args = config.get('args', {})
    
    # Skip default values
    for key, value in args.items():
        default = DEFAULT_ARGS.get(key)
        if value == default:
            continue
        
        flag = f'--{key.replace("_", "-")}'
        if isinstance(value, bool):
            if value:  # Only add boolean flags when true
                cmd.append(flag)
        elif isinstance(value, (int, float)):
            cmd.extend([flag, str(value)])
        elif value:  # Non-empty string
            cmd.extend([flag, str(value)])
    
    return cmd
```

### 3. Handle Special Cases
- **Boolean flags**: Only add to command when `True` (e.g., `--flash-attn` not `--flash-attn False`)
- **Empty strings**: Don't add to command (e.g., `grammar_file: ''` → no `--grammar-file` flag)
- **Zero vs default zero**: `threads: 0` is the default, so skip. But if user explicitly sets `0`, it should still be skipped (0 = auto-detect, same as default)
- **Negative values**: `-1` for `gpu_layers` and `seed` are defaults, skip them
- **Float precision**: Compare floats with tolerance (e.g., `0.8` vs `0.80000000001`)

### 4. Float Comparison Helper
```python
def _values_equal(a: Any, b: Any, tolerance: float = 1e-9) -> bool:
    if isinstance(a, float) and isinstance(b, float):
        return abs(a - b) < tolerance
    return a == b
```

### 5. Update Template Defaults (`ui/src/templates/llama-templates.json`)
Ensure template args match backend defaults so templates don't emit unnecessary flags:

```json
{
  "id": "run_tinyllama_cpu",
  "name": "TinyLlama (CPU)",
  "args": {
    "gpu_layers": -1,
    "threads": 0,
    "temp": 0.8,
    "context_size": 0,
    "n_predict": 256,
    "top_k": 40,
    "top_p": 0.95
  }
}
```

### 6. Add Command Preview to UI (`ui/src/modules/launch/LaunchPage.tsx`)
Show the actual command that will be run (without default args):
- Add a "Command Preview" section in the launch page
- Show the generated command before launching
- Allow user to see what flags will be used
- Useful for debugging and learning llama-server options

### 7. Logging
- Log the generated command (without default args) when server starts
- Add `--verbose` mode to show all args including defaults (for debugging)

### Files to Modify
- `backend/llama_runner.py` — Add DEFAULT_ARGS, modify generate_command(), add _values_equal()
- `backend/api_server.py` — Update validation to use DEFAULT_ARGS
- `ui/src/modules/launch/LaunchPage.tsx` — Add command preview section
- `ui/src/templates/llama-templates.json` — Ensure template defaults match backend defaults
