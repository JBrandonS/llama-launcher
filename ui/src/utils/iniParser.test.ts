import { parseIni, parseModelIni, iniKeysToFormFields } from './iniParser';
import type { IniData } from './iniParser';

describe('parseIni', () => {
  it('parses a simple INI with one section', () => {
    const ini = `[model]
path = /models/test.gguf
threads = 8`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/test.gguf');
    expect(result.model.threads).toBe('8');
  });

  it('parses multiple sections', () => {
    const ini = `[model]
path = /models/test.gguf

[sampling]
temp = 0.7
top-k = 40`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/test.gguf');
    expect(result.sampling.temp).toBe('0.7');
    expect(result.sampling['top-k']).toBe('40');
  });

  it('skips comments starting with #', () => {
    const ini = `[model]
# This is a comment
path = /models/test.gguf`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/test.gguf');
    expect('# This is a comment' in result.model).toBe(false);
  });

  it('skips comments starting with ;', () => {
    const ini = `[model]
; This is also a comment
path = /models/test.gguf`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/test.gguf');
  });

  it('skips blank lines', () => {
    const ini = `[model]

path = /models/test.gguf

[sampling]

temp = 0.7`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/test.gguf');
    expect(result.sampling.temp).toBe('0.7');
  });

  it('handles keys with spaces around equals', () => {
    const ini = `[model]
path   =   /models/test.gguf  
threads = 8`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/test.gguf');
    expect(result.model.threads).toBe('8');
  });

  it('handles values with spaces', () => {
    const ini = `[model]
path = /models/my llama model.gguf`;

    const result = parseIni(ini);

    expect(result.model.path).toBe('/models/my llama model.gguf');
  });

  it('ignores key-value pairs before any section header', () => {
    const ini = `orphan-key = value

[model]
path = /models/test.gguf`;

    const result = parseIni(ini);

    expect(result['orphan-key']).toBeUndefined();
    expect(result.model.path).toBe('/models/test.gguf');
  });

  it('handles empty INI', () => {
    const result = parseIni('');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('handles INI with only comments', () => {
    const ini = `# Only comments\n; Nothing else`;
    const result = parseIni(ini);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('trims section names', () => {
    const ini = `[  model  ]
path = /models/test.gguf`;

    const result = parseIni(ini);

    expect(result['model'].path).toBe('/models/test.gguf');
  });

  it('handles values with equals signs', () => {
    const ini = `[server]
command = echo "hello=world"`;

    const result = parseIni(ini);

    expect(result.server.command).toBe('echo "hello=world"');
  });
});

describe('parseModelIni', () => {
  it('parses basic model settings', () => {
    const ini = `[model]
path = /models/llama-3.2-1b.Q4_K_M.gguf
ctx-size = 4096
gpu-layers = 35
threads = 8
embedding = true`;

    const result = parseModelIni(ini);

    expect(result.modelPath).toBe('/models/llama-3.2-1b.Q4_K_M.gguf');
    expect(result.ctxSize).toBe(4096);
    expect(result.gpuLayers).toBe(35);
    expect(result.threads).toBe(8);
    expect(result.embedding).toBe(true);
  });

  it('parses server settings', () => {
    const ini = `[server]
host = 0.0.0.0
port = 8501`;

    const result = parseModelIni(ini);

    expect(result.host).toBe('0.0.0.0');
    expect(result.port).toBe(8501);
  });

  it('parses sampling settings', () => {
    const ini = `[sampling]
temp = 0.7
top-k = 40
top-p = 0.95
n-predict = 512`;

    const result = parseModelIni(ini);

    expect(result.temp).toBe(0.7);
    expect(result.topK).toBe(40);
    expect(result.topP).toBe(0.95);
    expect(result.nPredict).toBe(512);
  });

  it('parses advanced settings', () => {
    const ini = `[advanced]
rope-scaling = yarn`;

    const result = parseModelIni(ini);

    expect(result.ropeScaling).toBe('yarn');
  });

  it('handles empty INI gracefully', () => {
    const result = parseModelIni('');
    expect(result.modelPath).toBeUndefined();
    expect(result.host).toBeUndefined();
    expect(result.port).toBeUndefined();
  });

  it('parses boolean embedding value', () => {
    const ini = `[model]
embedding = true`;
    expect(parseModelIni(ini).embedding).toBe(true);

    const ini2 = `[model]
embedding = false`;
    expect(parseModelIni(ini2).embedding).toBe(false);

    const ini3 = `[model]
embedding = yes`;
    expect(parseModelIni(ini3).embedding).toBe(false); // only 'true' is truthy
  });

  it('ignores unknown sections', () => {
    const ini = `[unknown]
foo = bar

[model]
path = /models/test.gguf`;

    const result = parseModelIni(ini);
    expect(result.modelPath).toBe('/models/test.gguf');
  });

  it('handles all sections together', () => {
    const ini = `[model]
path = /models/llama.gguf
ctx-size = 2048
gpu-layers = 20
threads = 4
embedding = false

[server]
host = 127.0.0.1
port = 8080

[sampling]
temp = 0.5
top-k = 30
top-p = 0.9
n-predict = 256

[advanced]
rope-scaling = linear`;

    const result = parseModelIni(ini);

    expect(result.modelPath).toBe('/models/llama.gguf');
    expect(result.ctxSize).toBe(2048);
    expect(result.gpuLayers).toBe(20);
    expect(result.threads).toBe(4);
    expect(result.embedding).toBe(false);
    expect(result.host).toBe('127.0.0.1');
    expect(result.port).toBe(8080);
    expect(result.temp).toBe(0.5);
    expect(result.topK).toBe(30);
    expect(result.topP).toBe(0.9);
    expect(result.nPredict).toBe(256);
    expect(result.ropeScaling).toBe('linear');
  });
});

describe('iniKeysToFormFields', () => {
  it('maps model section keys to form field names', () => {
    const ini: IniData = {
      model: { path: '/models/test.gguf', 'ctx-size': '4096', threads: '8' },
    };

    const result = iniKeysToFormFields(ini);

    expect(result.modelPath).toBe('/models/test.gguf');
    expect(result['ctx_size']).toBe('4096');
    expect(result.threads).toBe('8');
  });

  it('maps sampling section keys', () => {
    const ini: IniData = {
      sampling: { temp: '0.7', 'top-k': '40', 'top-p': '0.95' },
    };

    const result = iniKeysToFormFields(ini);

    expect(result.temp).toBe('0.7');
    expect(result.top_k).toBe('40');
    expect(result.top_p).toBe('0.95');
  });

  it('maps advanced section keys', () => {
    const ini: IniData = {
      advanced: { 'rope-scaling': 'yarn' },
    };

    const result = iniKeysToFormFields(ini);

    expect(result.rope_scaling).toBe('yarn');
  });

  it('handles unknown keys by passing them through', () => {
    const ini: IniData = {
      model: { 'unknown-key': 'some-value' },
    };

    const result = iniKeysToFormFields(ini);

    expect(result['unknown_key']).toBe('some-value');
  });

  it('handles empty INI', () => {
    const result = iniKeysToFormFields({} as IniData);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('maps all flag-to-key conversions correctly', () => {
    const ini: IniData = {
      model: { path: '/models/test.gguf', 'gpu-layers': '32' },
      sampling: { temp: '0.7', 'top-k': '40' },
    };

    const result = iniKeysToFormFields(ini);

    // path -> modelPath
    expect(result.modelPath).toBe('/models/test.gguf');
    // gpu-layers -> gpu_layers
    expect(result.gpu_layers).toBe('32');
    // top-k -> top_k
    expect(result.top_k).toBe('40');
  });
});
