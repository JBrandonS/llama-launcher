/**
 * Simple INI file parser for llama.cpp-style configuration files.
 * Supports sections [name], key=value pairs, comments (#, ;), and blank lines.
 */

export interface IniData {
  [section: string]: Record<string, string>;
}

export function parseIni(content: string): IniData {
  const result: IniData = {};
  let currentSection: string | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    // Section header
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!(currentSection in result)) {
        result[currentSection] = {};
      }
      continue;
    }

    // Key=value pair
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0 && currentSection !== null) {
      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();
      result[currentSection][key] = value;
    }
  }

  return result;
}

/** Map of llama.cpp CLI flag names to INI key names. */
const FLAG_TO_INI_KEY: Record<string, string> = {
  'model': 'path',
  'host': 'host',
  'port': 'port',
  'ctx-size': 'ctx-size',
  'n-gpu-layers': 'gpu-layers',
  'threads': 'threads',
  'temp': 'temp',
  'top-k': 'top-k',
  'top-p': 'top-p',
  'n-predict': 'n-predict',
  'embedding': 'embedding',
  'rope-scaling': 'rope-scaling',
  'repeat-penalty': 'repeat-penalty',
};

/** Map of INI keys back to llama.cpp CLI flag names. */
const INI_KEY_TO_FLAG: Record<string, string> = Object.fromEntries(
  Object.entries(FLAG_TO_INI_KEY).map(([k, v]) => [v, k])
);

export interface ParsedModelConfig {
  modelPath?: string;
  host?: string;
  port?: number;
  ctxSize?: number;
  gpuLayers?: number;
  threads?: number;
  temp?: number;
  topK?: number;
  topP?: number;
  nPredict?: number;
  embedding?: boolean;
  ropeScaling?: string;
}

export function parseModelIni(content: string): ParsedModelConfig {
  const data = parseIni(content);
  const config: ParsedModelConfig = {};

  const modelSection = data['model'] || {};
  const serverSection = data['server'] || {};
  const samplingSection = data['sampling'] || {};
  const advancedSection = data['advanced'] || {};

  // Server section
  if (serverSection.host) config.host = serverSection.host;
  if (serverSection.port) config.port = parseInt(serverSection.port, 10);

  // Model section
  if (modelSection.path) config.modelPath = modelSection.path;
  if (modelSection['ctx-size']) config.ctxSize = parseInt(modelSection['ctx-size'], 10);
  if (modelSection['gpu-layers']) config.gpuLayers = parseInt(modelSection['gpu-layers'], 10);
  if (modelSection.threads) config.threads = parseInt(modelSection.threads, 10);
  if (modelSection.embedding) config.embedding = modelSection.embedding === 'true';

  // Sampling section
  if (samplingSection.temp) config.temp = parseFloat(samplingSection.temp);
  if (samplingSection['top-k']) config.topK = parseInt(samplingSection['top-k'], 10);
  if (samplingSection['top-p']) config.topP = parseFloat(samplingSection['top-p']);
  if (samplingSection['n-predict']) config.nPredict = parseInt(samplingSection['n-predict'], 10);

  // Advanced section
  if (advancedSection['rope-scaling']) config.ropeScaling = advancedSection['rope-scaling'];

  return config;
}

export function iniKeysToFormFields(ini: IniData): Record<string, string> {
  const fields: Record<string, string> = {};

  const modelSection = ini['model'] || {};
  const samplingSection = ini['sampling'] || {};
  const advancedSection = ini['advanced'] || {};

  // Map INI keys to form field names
  for (const [key, value] of Object.entries(modelSection)) {
    const flagKey = INI_KEY_TO_FLAG[key] || key;
    if (flagKey === 'path') fields.modelPath = value;
    else fields[flagKey] = value;
  }

  for (const [key, value] of Object.entries(samplingSection)) {
    const flagKey = INI_KEY_TO_FLAG[key] || key;
    fields[flagKey] = value;
  }

  for (const [key, value] of Object.entries(advancedSection)) {
    const flagKey = INI_KEY_TO_FLAG[key] || key;
    fields[flagKey] = value;
  }

  return fields;
}
