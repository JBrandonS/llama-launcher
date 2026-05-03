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

// ── INI conversion helpers ───────────────────────────────────────

const SECTION_MAP: Array<[string, string]> = [
  ['port', 'server.port'],
  ['host', 'server.host'],
  ['gpu_layers', 'model.gpu-layers'],
  ['context_size', 'model.ctx-size'],
  ['threads', 'model.threads'],
  ['embedding', 'model.embedding'],
  ['temp', 'sampling.temp'],
  ['top_k', 'sampling.top-k'],
  ['top_p', 'sampling.top-p'],
  ['min_p', 'sampling.min-p'],
  ['typical_p', 'sampling.typical-p'],
  ['repeat_penalty', 'sampling.repeat-penalty'],
  ['repeat_last_n', 'sampling.repeat-last-n'],
  ['presence_penalty', 'sampling.presence-penalty'],
  ['frequency_penalty', 'sampling.frequency-penalty'],
  ['mirostat', 'sampling.mirostat'],
  ['mirostat_tau', 'sampling.mirostat-tau'],
  ['mirostat_eta', 'sampling.mirostat-eta'],
  ['seed', 'model.seed'],
  ['n_predict', 'model.n-predict'],
  ['num_keep', 'sampling.num-keep'],
  ['rope_freq_scale', 'model.rope-freq-scale'],
  ['batch_size', 'performance.batch-size'],
  ['cache_reuse', 'performance.cache-reuse'],
  ['no_mmap', 'model.no-mmap'],
  ['flash_attention', 'model.flash-attn'],
  ['jinja', 'model.jinja'],
  ['reasoning', 'model.reasoning'],
  ['reasoning_budget', 'model.reasoning-budget'],
  ['kv_unified', 'model.kv-unified'],
].map(([key, section]) => [key, section] as const);

function toIniSections(args: TemplateArgs, modelPath: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {
    server: {},
    model: {},
    sampling: {},
    performance: {},
  };

  // Always set model path
  sections.model.path = modelPath;

  for (const [key, section] of SECTION_MAP) {
    const value = args[key as keyof TemplateArgs];
    if (value === undefined || value === null || value === '') continue;
    const targetSection = section.split('.')[0];
    const targetKey = section.split('.')[1];
    if (!sections[targetSection]) sections[targetSection] = {};
    sections[targetSection][targetKey] = String(value);
  }

  // Remove empty sections
  for (const [section, values] of Object.entries(sections)) {
    if (Object.keys(values).length === 0) delete sections[section];
  }

  return sections;
}

function toIniString(sections: Record<string, Record<string, string>>): string {
  const lines: string[] = [];
  for (const [section, values] of Object.entries(sections)) {
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(values)) {
      lines.push(`${key} = ${value}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function fromIniString(ini: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let currentSection = '';

  for (const line of ini.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] = {};
      continue;
    }

    const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (kvMatch && currentSection) {
      sections[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }

  return sections;
}

function toTemplateArgs(sections: Record<string, Record<string, string>>): TemplateArgs {
  const args: TemplateArgs = {};
  const keyMap = new Map<string, keyof TemplateArgs>();

  for (const [key, section] of SECTION_MAP) {
    keyMap.set(section, key as keyof TemplateArgs);
  }

  for (const [, values] of Object.entries(sections)) {
    for (const [key, value] of Object.entries(values)) {
      const targetKey = keyMap.get(key);
      if (!targetKey) continue;

      // Parse numeric values
      const num = Number(value);
      if (!isNaN(num)) {
        args[targetKey] = num as any;
      } else if (value.toLowerCase() === 'true') {
        args[targetKey] = true as any;
      } else if (value.toLowerCase() === 'false') {
        args[targetKey] = false as any;
      } else {
        args[targetKey] = value as any;
      }
    }
  }

  return args;
}

export async function saveTemplateToFile(template: Template, modelPath: string): Promise<void> {
  const sections = toIniSections(template.args, modelPath);
  const iniContent = toIniString(sections);

  // Try File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${template.id}.ini`,
        types: [{
          description: 'llama.cpp config',
          accept: { 'text/plain': ['.ini', '.txt'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(iniContent);
      await writable.close();
      return;
    } catch { /* user cancelled or API failed */ }
  }

  // Fallback: blob download
  const blob = new Blob([iniContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.id}.ini`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function loadTemplateFromFile(file: File): Promise<Template> {
  const text = await file.text();
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'ini' || ext === 'txt') {
    const sections = fromIniString(text);
    const args = toTemplateArgs(sections);
    return {
      id: file.name.replace(/\.ini$/, '').replace(/\.txt$/, ''),
      name: file.name,
      model: sections.model?.path ?? '',
      source: 'file' as const,
      args,
    };
  }

  // Default: try JSON
  const data = JSON.parse(text);
  return {
    id: data.id || file.name.replace(/\.json$/, ''),
    name: data.name || file.name,
    model: data.model || '',
    source: 'file' as const,
    args: data.args || {},
  };
}

export const TemplateLoader = {
  templates,
  resolveAlias,
  getTemplatesForModel,
  getDefaultTemplate,
  applyTemplate,
  saveLastUsed,
};
