# Plan: Model Alias Support + HuggingFace Quantization Detection

## Problem
Users cannot specify models by alias (e.g., "qwen3.6-35b") — they must use full HuggingFace repo identifiers (e.g., "unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M"). The system should:
1. Accept model aliases and resolve them to full identifiers
2. Auto-detect quantization from HuggingFace model card info
3. Show quantization tier (Q2_K, Q3_K_S, Q4_K_M, Q5_K_M, Q8_0, FP16, etc.) in the UI
4. Allow users to select quantization variant when downloading

## Current State
- `ui/src/utils/templateLoader.ts` — 3-tier template matching (model name, `models[]` array, filename stem)
- `ui/src/templates/llama-templates.json` — Templates use full HuggingFace paths like `unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M`
- `backend/model_manager.py` — ModelManager with local scanning + HuggingFace async downloads
- `backend/api_server.py` — `/models` endpoint returns `ModelInfo` objects
- `ui/src/modules/launch/LaunchPage.tsx` — Model selection dropdown shows `model.path` (full path)
- `ui/src/services/types.ts` — `ModelInfo` type has `id`, `path`, `size_human`

## Implementation Plan

### 1. Backend: Model Alias Resolution (`backend/model_manager.py`)
- Add alias registry (config file or embedded defaults) mapping short names to full identifiers
- When a model is specified by alias, resolve to full HuggingFace identifier before download
- Parse HuggingFace model card to detect available quantization variants
- Query HuggingFace API (`https://huggingface.co/api/models/{repo_id}`) to list files and detect quantization tiers from filenames (e.g., `Q4_K_M.gguf`, `Q5_K_M.gguf`)
- Return quantization options to frontend

### 2. Backend: API Changes (`backend/api_server.py`)
- Add `GET /models/resolve?alias=<alias>` endpoint — resolve alias to full identifier
- Modify `GET /models` to return quantization info per model
- Add `GET /models/quantizations?model=<model_id>` — list available quantization variants for a model
- Update `POST /models/download` to accept `quantization` parameter

### 3. Frontend: Model Info Types (`ui/src/services/types.ts`)
```typescript
interface ModelInfo {
  id: string;
  path: string;
  size_human: string;
  aliases?: string[];           // NEW: short names
  quantizations?: QuantizationInfo[];  // NEW: available quantizations
}

interface QuantizationInfo {
  tag: string;                  // e.g., "Q4_K_M"
  size?: string;
  filename?: string;
  isRecommended?: boolean;
}
```

### 4. Frontend: Model Selection UI (`ui/src/modules/launch/LaunchPage.tsx`)
- When user types a model name, show alias suggestions (e.g., "qwen3.6-35b" → "unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M")
- Add quantization selector when downloading a model (dropdown of available quantizations)
- Show quantization badge next to model name in dropdown
- Allow manual alias editing in model search field

### 5. Alias Registry (`backend/model_aliases.json` or embedded)
```json
{
  "qwen3.6-35b": "unsloth/qwen3.6-35B-A3B-GGUF:UD-Q4_K_M",
  "llama3.2": "unsloth/llama-3.2-1B-Instruct-GGUF:Q4_K_M",
  ...
}
```

### 6. HuggingFace Quantization Detection
- Use HuggingFace API: `GET https://huggingface.co/api/models/{repo_id}`
- Parse `siblings` array for `.gguf` files
- Extract quantization tag from filename patterns:
  - `*-Q2_K.gguf`, `*-Q3_K_S.gguf`, `*-Q3_K_M.gguf`, `*-Q3_K_L.gguf`
  - `*-Q4_0.gguf`, `*-Q4_K_S.gguf`, `*-Q4_K_M.gguf`
  - `*-Q5_0.gguf`, `*-Q5_K_S.gguf`, `*-Q5_K_M.gguf`
  - `*-Q6_K.gguf`, `*-Q8_0.gguf`, `*-F16.gguf`
- Recommend smallest quantization that fits typical GPU memory

### Files to Modify
- `backend/model_manager.py` — Add alias resolution, HuggingFace API queries, quantization detection
- `backend/api_server.py` — Add `/models/resolve` and `/models/quantizations` endpoints
- `ui/src/services/types.ts` — Add `QuantizationInfo`, extend `ModelInfo`
- `ui/src/services/apiService.ts` — Add API methods for resolve/quantizations
- `ui/src/modules/launch/LaunchPage.tsx` — Update model selection dropdown, add quantization selector
- `ui/src/utils/templateLoader.ts` — Use resolved aliases in template matching
