import templatesData from '../templates/llama-templates.json' with { type: 'json' };

// ── Alias registry (mirrors backend/model_aliases.json) ──────────
const ALIAS_MAP: Record<string, string> = {
  'qwen3.6-35b': 'Qwen/Qwen3.6-35B-A4-Band-GGUF',
  'qwen3.6': 'Qwen/Qwen3.6-35B-A4-Band-GGUF',
  'llama3.2-1b': 'huggingface/llama3.2-1b-GGUF',
  'tinyllama': 'TinyLlama/TinyLlama-1.1B-Chat-v1.0-GGUF',
  'embeddinggemma': 'google/gemma-3-1b-it-GGUF',
  'qwen3-reranker': 'Qwen/Qwen3-Reranker-8B-A4.2B-GGUF',
};

export interface TemplateArgs {
  port?: number;
  gpu_layers?: number;
  context_size?: number;
  threads?: number;
  temp?: number;
  top_k?: number;
  top_p?: number;
  min_p?: number;
  typical_p?: number;
  penalty_range?: number;
  repeat_penalty?: number;
  repeat_last_n?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  seed?: number;
  n_predict?: number;
  num_keep?: number;
  rope_freq_scale?: number;
  batch_size?: number;
  cache_reuse?: number;
  cache_type_k?: string;
  cache_type_v?: string;
  jinja?: boolean;
  reasoning?: string;
  reasoning_budget?: number;
  kv_unified?: boolean;
  no_mmap?: boolean;
  flash_attention?: boolean;
  no_webui?: boolean;
  sleep_idle_seconds?: number;
  model_alias?: string;
  embedding?: boolean;
  reranking?: boolean;
  pooling?: string;
  [key: string]: unknown;
}

export interface Template {
  id: string;
  name: string;
  model: string;
  models?: string[]; // optional local filename patterns
  source: string;
  args: TemplateArgs;
}

export interface TemplatesConfig {
  version: number;
  templates: Template[];
}

export const templates: Template[] = templatesData.templates;

const LOCAL_STORAGE_KEY = 'llama-launcher:template-last-used';

function resolveAlias(modelPath: string): string {
  const normalized = modelPath.trim().toLowerCase();
  for (const [alias, resolved] of Object.entries(ALIAS_MAP)) {
    if (alias.toLowerCase() === normalized) return resolved;
  }
  return modelPath;
}

function getLastUsedTemplate(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLastUsedTemplate(model: string, templateId: string): void {
  try {
    const lastUsed = getLastUsedTemplate();
    lastUsed[model] = templateId;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lastUsed));
  } catch {
    // localStorage unavailable
  }
}

function getTemplatesForModel(modelPath: string): Template[] {
  const resolved = resolveAlias(modelPath);
  const normalized = resolved.toLowerCase();
  const filename = modelPath.split('/').pop()?.toLowerCase() ?? '';
  const filenameStem = filename.replace(/\.[^.]+$/, ''); // remove extension
  return templates.filter((t) => {
    const templateModel = t.model.toLowerCase();
    // Primary: bidirectional substring match on model id/name
    if (
      normalized.includes(templateModel) ||
      templateModel.includes(normalized) ||
      normalized.includes(t.id) ||
      t.id.includes(normalized)
    ) {
      return true;
    }
    // Fallback: match against explicit local filename patterns
    if (Array.isArray((t as Template & { models?: string[] }).models)) {
      const localPatterns = (t as Template & { models?: string[] }).models as string[];
      if (
        localPatterns.some((p) => normalized.includes(p) || filename.includes(p.toLowerCase()))
      ) {
        return true;
      }
    }
    // Fallback: match filename stem (without extension) against template model name segments
    if (
      filenameStem &&
      templateModel.includes(filenameStem) &&
      !templateModel.includes('models--')
    ) {
      return true;
    }
    return false;
  });
}

function getDefaultTemplate(modelPath: string): Template | null {
  const resolved = resolveAlias(modelPath);
  const matching = getTemplatesForModel(modelPath);
  if (matching.length === 0) return null;

  const lastUsed = getLastUsedTemplate();

  // Priority 1: last used template for this model (try both raw and resolved)
  const lastUsedId = lastUsed[modelPath] ?? lastUsed[resolved];
  if (lastUsedId) {
    const found = matching.find((t) => t.id === lastUsedId);
    if (found) return found;
  }

  // Priority 2: most recent file (sorted by source path alphabetically as proxy)
  const sorted = [...matching].sort((a, b) => b.source.localeCompare(a.source));
  if (sorted.length > 0) return sorted[0];

  // Priority 3: first matching template
  return matching[0];
}

function applyTemplate(template: Template): {
  args: TemplateArgs;
  port: number;
} {
  return {
    args: { ...template.args },
    port: template.args.port ?? 12345,
  };
}

function saveLastUsed(modelPath: string, templateId: string): void {
  saveLastUsedTemplate(modelPath, templateId);
}

export const TemplateLoader = {
  templates,
  resolveAlias,
  getTemplatesForModel,
  getDefaultTemplate,
  applyTemplate,
  saveLastUsed,
};
