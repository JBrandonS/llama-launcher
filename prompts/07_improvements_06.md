# Plan: Add All llama-server CLI Options to Launch Page

## Problem
Not all llama-server CLI options are available on the launch page. Users cannot configure advanced options that are supported by llama-server.

## Current State
- `ui/src/modules/launch/LaunchPage.tsx` — Launch page with parameter form
- Has 4 collapsible sections: Model & GPU, Sampling, Context, Advanced
- Current form fields (23 fields):
  - `gpu_layers`, `context_size`, `threads`, `temp`, `top_k`, `top_p`
  - `min_p`, `typical_p`, `penalty_range`, `repeat_penalty`, `repeat_last_n`
  - `presence_penalty`, `frequency_penalty`, `mirostat`, `mirostat_tau`, `mirostat_eta`
  - `seed`, `n_predict`, `num_keep`, `rope_freq_scale`, `grammar_file`
  - `batch_size`, `cache_reuse`
- `backend/llama_runner.py` — LlamaRunner.generate_command() builds CLI args
- `backend/llama_runner.py` — `_clamp_n_predict` validates n_predict range

## Implementation Plan

### 1. Research llama-server CLI Options
Get the complete list of llama-server CLI options by running:
```bash
llama-server --help
```
Or check llama.cpp documentation/GitHub for the full list of options.

Common missing options likely include:
- `--log-disable` — Disable logging
- `--log-prefix` — Log prefix
- `--host` — Host binding (default: 127.0.0.1)
- `--cors` — Enable CORS
- `--cors-allow-origin` — Allowed CORS origins
- `--grpca-address` — GRPC address
- `--grpca-port` — GRPC port
- `--embedding` — Enable embedding mode
- `--ctx-size` — Context size (already have as `context_size`)
- `--batch-size` — Batch size (already have as `batch_size`)
- `--n-ctx` — Number of context tokens
- `--flash-attn` — Enable flash attention
- `--no-mmap` — Disable memory mapping
- `--mlock` — Force memory lock
- `--numa` — NUMA optimization
- `--logits-all` — Logits for all tokens
- `--rope-scaling` — RoPE scaling type (none, linear, yarn)
- `--rope-freq-base` — RoPE frequency base
- `--tensor-parallel` — Tensor parallel size (multi-GPU)
- `--ubatch-size` — Uniform batch size
- `--keep-live` — Keep model loaded after N seconds
- `--speculative` — Speculative decoding
- `--speculative-num` — Speculative tokens
- `--draft` — Draft model path
- `--prompt-cache` — Prompt cache file
- `--prompt-cache-all` — Cache all prompts
- `--cont-batching` — Continuous batching
- `--verbose` — Verbose output
- `--server-name` — Server name for metrics
- `--api-key` — API key for authentication

### 2. Backend: Extend LlamaRunner (`backend/llama_runner.py`)
- Add all new CLI options to `generate_command()` method
- Map each option to proper llama-server flag format (e.g., `--gpu-layers`, `--ctx-size`)
- Add type validation for each option
- Handle boolean flags (present if true, absent if false)
- Handle options with values (e.g., `--host 0.0.0.0`)
- Handle options with arrays (e.g., `--cors-allow-origin https://a.com https://b.com`)

### 3. Backend: Update Validation (`backend/api_server.py`)
- Add validation for new options in `/validate` endpoint
- Add default values for new options
- Document new options in validation response

### 4. Frontend: Add Parameter Sections (`ui/src/modules/launch/LaunchPage.tsx`)
Add new collapsible sections for advanced options:

**Section: Network**
- `host` — SelectInput (127.0.0.1, 0.0.0.0)
- `port` — Already exists
- `cors` — SelectInput (Off, Enabled)
- `cors_allow_origin` — Text input (comma-separated)
- `api_key` — Password input

**Section: Performance**
- `flash_attn` — SelectInput (Off, Enabled)
- `no_mmap` — SelectInput (Off, Enabled)
- `mlock` — SelectInput (Off, Enabled)
- `numa` — SelectInput (Off, Enabled)
- `cont_batching` — SelectInput (Off, Enabled)

**Section: RoPE**
- `rope_scaling` — SelectInput (none, linear, yarn)
- `rope_freq_base` — NumberInput (default: 1000000)

**Section: Advanced**
- `embedding` — SelectInput (Off, Enabled)
- `logits_all` — SelectInput (Off, Enabled)
- `speculative` — SelectInput (Off, Enabled)
- `draft_model` — Text input (file path)
- `prompt_cache` — Text input (file path)
- `keep_live` — NumberInput (seconds)

### 5. Frontend: Update Form Types (`ui/src/services/types.ts`)
```typescript
interface LaunchArgs {
  // Existing fields
  gpu_layers: number;
  context_size: number;
  threads: number;
  // ... existing fields ...

  // New fields
  host: string;
  cors: boolean;
  cors_allow_origin: string;
  api_key: string;
  flash_attn: boolean;
  no_mmap: boolean;
  mlock: boolean;
  numa: boolean;
  cont_batching: boolean;
  rope_scaling: string;
  rope_freq_base: number;
  embedding: boolean;
  logits_all: boolean;
  speculative: boolean;
  draft_model: string;
  prompt_cache: string;
  keep_live: number;
}
```

### 6. Frontend: Update Preset System
- Update `PresetsManager.tsx` to support new fields
- Update `PresetFormData` interface in `LaunchPage.tsx`
- Update `DEFAULT_FORM` with sensible defaults for new fields
- Update `applyPreset` to handle new fields

### 7. Frontend: Update Template System
- Update `llama-templates.json` with new options in templates
- Update `templateLoader.ts` to handle new fields
- Ensure backward compatibility with existing templates

### Files to Modify
- `backend/llama_runner.py` — Add all new CLI options to command generation
- `backend/api_server.py` — Add validation for new options
- `ui/src/modules/launch/LaunchPage.tsx` — Add new parameter sections
- `ui/src/services/types.ts` — Extend LaunchArgs type
- `ui/src/modules/launch/PresetsManager.tsx` — Support new fields in presets
- `ui/src/utils/templateLoader.ts` — Handle new fields in templates
- `ui/src/templates/llama-templates.json` — Update template definitions
