import { parseConfig, getPreviewArgs } from './configParser';

describe('parseConfig', () => {
  describe('valid configs', () => {
    it('parses a minimal valid config', () => {
      const json = JSON.stringify({ model: '/models/test.gguf', port: 8501 });
      const result = parseConfig(json);

      expect(result.errors).toHaveLength(0);
      expect(result.config).toEqual({
        model: '/models/test.gguf',
        port: 8501,
      });
    });

    it('parses a config with optional name', () => {
      const json = JSON.stringify({ name: 'My Server', model: '/models/test.gguf', port: 8501 });
      const result = parseConfig(json);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.name).toBe('My Server');
    });

    it('parses a config with args', () => {
      const json = JSON.stringify({ model: '/models/test.gguf', port: 8501, args: { gpu_layers: 32, threads: 8 } });
      const result = parseConfig(json);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.args).toEqual({ gpu_layers: 32, threads: 8 });
    });

    it('parses a config with env', () => {
      const json = JSON.stringify({ model: '/models/test.gguf', port: 8501, env: { KEY: 'value' } });
      const result = parseConfig(json);

      expect(result.errors).toHaveLength(0);
      expect(result.config!.env).toEqual({ KEY: 'value' });
    });

    it('parses config with all optional fields', () => {
      const json = JSON.stringify({
        name: 'Test',
        model: '/models/test.gguf',
        port: 8501,
        args: { foo: 'bar' },
        env: { FOO: 'bar' },
      });
      const result = parseConfig(json);

      expect(result.errors).toHaveLength(0);
      expect(result.config).toEqual({
        name: 'Test',
        model: '/models/test.gguf',
        port: 8501,
        args: { foo: 'bar' },
        env: { FOO: 'bar' },
      });
    });
  });

  describe('invalid JSON', () => {
    it('rejects invalid JSON', () => {
      const result = parseConfig('{ invalid json }');

      expect(result.config).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('$');
      expect(result.errors[0].message).toBe('Invalid JSON');
    });
  });

  describe('non-object values', () => {
    it('rejects a JSON array (arrays are objects in JS, so model/port validation runs)', () => {
      const result = parseConfig('[1, 2, 3]');

      expect(result.config).toBeNull();
      // Arrays pass typeof check since typeof [] === 'object', so model validation runs next
      expect(result.errors.some(e => e.field === 'model')).toBe(true);
    });

    it('rejects a JSON string', () => {
      const result = parseConfig('"not an object"');

      expect(result.config).toBeNull();
      expect(result.errors[0].field).toBe('$');
    });

    it('rejects a JSON number', () => {
      const result = parseConfig('42');

      expect(result.config).toBeNull();
      expect(result.errors[0].message).toBe('Config must be a JSON object');
    });

    it('rejects null', () => {
      const result = parseConfig('null');

      expect(result.config).toBeNull();
      expect(result.errors[0].message).toBe('Config must be a JSON object');
    });
  });

  describe('model validation', () => {
    it('requires model field', () => {
      const result = parseConfig(JSON.stringify({ port: 8501 }));

      expect(result.errors.some(e => e.field === 'model')).toBe(true);
      expect(result.errors.some(e => e.message.includes('required'))).toBe(true);
    });

    it('requires model to be a string', () => {
      const result = parseConfig(JSON.stringify({ model: 123, port: 8501 }));

      expect(result.errors.some(e => e.field === 'model' && e.message.includes('string'))).toBe(true);
    });

    it('requires model to be non-empty', () => {
      const result = parseConfig(JSON.stringify({ model: '', port: 8501 }));

      expect(result.errors.some(e => e.field === 'model' && e.message.includes('empty'))).toBe(true);
    });

    it('accepts model with whitespace-only value as empty', () => {
      const result = parseConfig(JSON.stringify({ model: '   ', port: 8501 }));

      expect(result.errors.some(e => e.field === 'model' && e.message.includes('empty'))).toBe(true);
    });
  });

  describe('port validation', () => {
    it('requires port field', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf' }));

      expect(result.errors.some(e => e.field === 'port')).toBe(true);
    });

    it('rejects null port', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: null }));

      expect(result.errors.some(e => e.field === 'port')).toBe(true);
    });

    it('requires port to be a number', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: '8501' }));

      expect(result.errors.some(e => e.field === 'port' && e.message.includes('number'))).toBe(true);
    });

    it('requires port to be an integer', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501.5 }));

      expect(result.errors.some(e => e.field === 'port' && e.message.includes('integer'))).toBe(true);
    });

    it('requires port to be between 1 and 65535', () => {
      const resultLow = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 0 }));
      expect(resultLow.errors.some(e => e.field === 'port')).toBe(true);

      const resultHigh = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 65536 }));
      expect(resultHigh.errors.some(e => e.field === 'port')).toBe(true);
    });

    it('accepts valid port 1024', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 1024 }));
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid port 65535', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 65535 }));
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('name validation', () => {
    it('accepts string name', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, name: 'Test' }));
      expect(result.errors).toHaveLength(0);
    });

    it('rejects non-string name', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, name: 123 }));
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('omits undefined name', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501 }));
      expect(result.config!.name).toBeUndefined();
    });
  });

  describe('args validation', () => {
    it('rejects array as args', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, args: [1, 2] }));
      expect(result.errors.some(e => e.field === 'args')).toBe(true);
    });

    it('rejects non-object args', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, args: 'not-an-object' }));
      expect(result.errors.some(e => e.field === 'args')).toBe(true);
    });

    it('accepts valid args object', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, args: { foo: 'bar' } }));
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('env validation', () => {
    it('rejects array as env', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, env: [] }));
      expect(result.errors.some(e => e.field === 'env')).toBe(true);
    });

    it('rejects non-string env values', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, env: { KEY: 123 } }));
      expect(result.errors.some(e => e.field === 'env.KEY')).toBe(true);
    });

    it('accepts valid env object with string values', () => {
      const result = parseConfig(JSON.stringify({ model: '/models/test.gguf', port: 8501, env: { KEY: 'value' } }));
      expect(result.errors).toHaveLength(0);
    });

    it('reports each invalid env value separately', () => {
      const json = JSON.stringify({ model: '/models/test.gguf', port: 8501, env: { A: 1, B: 2 } });
      const result = parseConfig(json);
      expect(result.errors.some(e => e.field === 'env.A')).toBe(true);
      expect(result.errors.some(e => e.field === 'env.B')).toBe(true);
    });
  });

  describe('multiple errors', () => {
    it('reports multiple validation errors at once', () => {
      const result = parseConfig(JSON.stringify({ model: '', port: 99999 }));

      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.field === 'model')).toBe(true);
      expect(result.errors.some(e => e.field === 'port')).toBe(true);
    });
  });
});

describe('getPreviewArgs', () => {
  it('returns empty object when args is undefined', () => {
    expect(getPreviewArgs(undefined)).toEqual({});
  });

  it('returns empty object when args is null', () => {
    expect(getPreviewArgs(null as unknown as Record<string, unknown>)).toEqual({});
  });

  it('filters to only known preview keys', () => {
    const args = {
      gpu_layers: 32,
      threads: 8,
      temp: 0.7,
      context_size: 4096,
      top_k: 40,
      top_p: 0.95,
      n_predict: 512,
      unknown_key: 'should be filtered',
    };

    const result = getPreviewArgs(args);

    expect(result).toEqual({
      gpu_layers: 32,
      threads: 8,
      temp: 0.7,
      context_size: 4096,
      top_k: 40,
      top_p: 0.95,
      n_predict: 512,
    });
    expect('unknown_key' in result).toBe(false);
  });

  it('only includes keys that are present', () => {
    const args = { threads: 4 };
    const result = getPreviewArgs(args);

    expect(result).toEqual({ threads: 4 });
    expect('gpu_layers' in result).toBe(false);
  });

  it('preserves the correct key names from args', () => {
    const args = { gpu_layers: 35, context_size: 8192 };
    const result = getPreviewArgs(args);

    expect(result.gpu_layers).toBe(35);
    expect(result.context_size).toBe(8192);
  });
});
