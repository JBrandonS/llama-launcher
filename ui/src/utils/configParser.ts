import type { ValidationError } from '@services/types';

export interface ServerConfig {
  name?: string;
  model: string;
  port: number;
  args?: Record<string, unknown>;
  env?: Record<string, string>;
}

export interface ValidationResult {
  config: ServerConfig | null;
  errors: ValidationError[];
}

export function parseConfig(content: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { config: null, errors: [{ field: '$', message: 'Invalid JSON' }] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { config: null, errors: [{ field: '$', message: 'Config must be a JSON object' }] };
  }

  const obj = parsed as Record<string, unknown>;

  // Validate name (optional)
  if (obj.name !== undefined && typeof obj.name !== 'string') {
    errors.push({ field: 'name', message: 'Name must be a string' });
  }

  // Validate model (required)
  if (!obj.model) {
    errors.push({ field: 'model', message: 'Model path is required' });
  } else if (typeof obj.model !== 'string') {
    errors.push({ field: 'model', message: 'Model must be a string' });
  } else if (!obj.model.trim()) {
    errors.push({ field: 'model', message: 'Model path cannot be empty' });
  }

  // Validate port (required)
  if (obj.port === undefined || obj.port === null) {
    errors.push({ field: 'port', message: 'Port is required' });
  } else if (typeof obj.port === 'number') {
    const port = obj.port as number;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push({ field: 'port', message: 'Port must be an integer between 1 and 65535' });
    }
  } else {
    errors.push({ field: 'port', message: 'Port must be a number' });
  }

  // Validate args (optional, must be object)
  if (obj.args !== undefined) {
    if (typeof obj.args !== 'object' || Array.isArray(obj.args)) {
      errors.push({ field: 'args', message: 'Args must be an object' });
    }
  }

  // Validate env (optional, must be object with string values)
  if (obj.env !== undefined) {
    if (typeof obj.env !== 'object' || Array.isArray(obj.env)) {
      errors.push({ field: 'env', message: 'Env must be an object' });
    } else {
      for (const [key, value] of Object.entries(obj.env as Record<string, unknown>)) {
        if (typeof value !== 'string') {
          errors.push({ field: `env.${key}`, message: `Env value for "${key}" must be a string` });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { config: null, errors };
  }

  const config: ServerConfig = {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    model: obj.model as string,
    port: obj.port as number,
    args: typeof obj.args === 'object' && !Array.isArray(obj.args) ? obj.args as Record<string, unknown> : undefined,
    env: typeof obj.env === 'object' && !Array.isArray(obj.env) ? obj.env as Record<string, string> : undefined,
  };

  return { config, errors: [] };
}

export function getPreviewArgs(args?: Record<string, unknown>): Record<string, unknown> {
  if (!args) return {};
  const keys = ['gpu_layers', 'threads', 'temp', 'context_size', 'top_k', 'top_p', 'n_predict'];
  const preview: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in args) {
      preview[key] = args[key];
    }
  }
  return preview;
}
