import templatesData from '../templates/llama-templates.json' with { type: 'json' };

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
  num_predict?: number;
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
  source: string;
  args: TemplateArgs;
}

export interface TemplatesConfig {
  version: number;
  templates: Template[];
}

export const templates: Template[] = templatesData.templates;

const LOCAL_STORAGE_KEY = 'llama-launcher:template-last-used';

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
  const normalized = modelPath.toLowerCase();
  return templates.filter((t) => {
    const templateModel = t.model.toLowerCase();
    return (
      normalized.includes(templateModel) ||
      templateModel.includes(normalized) ||
      normalized.includes(t.id) ||
      t.id.includes(normalized)
    );
  });
}

function getDefaultTemplate(modelPath: string): Template | null {
  const matching = getTemplatesForModel(modelPath);
  if (matching.length === 0) return null;

  const lastUsed = getLastUsedTemplate();

  // Priority 1: last used template for this model
  const lastUsedId = lastUsed[modelPath];
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
  getTemplatesForModel,
  getDefaultTemplate,
  applyTemplate,
  saveLastUsed,
};
