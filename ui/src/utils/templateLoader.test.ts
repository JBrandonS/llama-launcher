import {
  saveTemplateAsIni,
  loadTemplateFromIni,
  TemplateArgs,
} from './templateLoader';

describe('saveTemplateAsIni', () => {
  it('generates INI with model path and basic settings', () => {
    const args: TemplateArgs = {
      gpu_layers: 35,
      context_size: 4096,
      threads: 8,
      temp: 0.7,
      top_k: 40,
      top_p: 0.95,
    };
    const modelPath = '/models/llama-3.2-1b.Q4_K_M.gguf';
    const result = saveTemplateAsIni(args, modelPath);

    expect(result).toContain('[model]');
    expect(result).toContain(`path = ${modelPath}`);
    expect(result).toContain('gpu-layers = 35');
    expect(result).toContain('ctx-size = 4096');
    expect(result).toContain('threads = 8');
    expect(result).toContain('[sampling]');
    expect(result).toContain('temp = 0.7');
    expect(result).toContain('top-k = 40');
    expect(result).toContain('top-p = 0.95');
  });

  it('includes server section when host/port are set', () => {
    const args: TemplateArgs = {
      port: 8501,
      host: '0.0.0.0',
    };
    const result = saveTemplateAsIni(args, '/models/test.gguf');

    expect(result).toContain('[server]');
    expect(result).toContain('port = 8501');
    expect(result).toContain('host = 0.0.0.0');
  });

  it('includes performance section', () => {
    const args: TemplateArgs = {
      batch_size: 2048,
      cache_reuse: 128,
      cont_batching: true,
    };
    const result = saveTemplateAsIni(args, '/models/test.gguf');

    expect(result).toContain('[performance]');
    expect(result).toContain('batch-size = 2048');
    expect(result).toContain('cache-reuse = 128');
    expect(result).toContain('cont-batching = true');
  });

  it('handles boolean values correctly', () => {
    const args: TemplateArgs = {
      no_mmap: true,
      flash_attention: false,
      embedding: true,
    };
    const result = saveTemplateAsIni(args, '/models/test.gguf');

    expect(result).toContain('no-mmap = true');
    expect(result).toContain('flash-attn = false');
    expect(result).toContain('embedding = true');
  });

  it('handles negative numeric values', () => {
    const args: TemplateArgs = {
      gpu_layers: -1,
      seed: -1,
      n_predict: -1,
    };
    const result = saveTemplateAsIni(args, '/models/test.gguf');

    expect(result).toContain('gpu-layers = -1');
    expect(result).toContain('seed = -1');
    expect(result).toContain('n-predict = -1');
  });

  it('skips undefined and null values', () => {
    const args: TemplateArgs = {
      gpu_layers: 35,
      context_size: undefined as unknown as number,
      threads: null as unknown as number,
    };
    const result = saveTemplateAsIni(args, '/models/test.gguf');

    expect(result).toContain('gpu-layers = 35');
    expect(result).not.toContain('ctx-size');
    expect(result).not.toContain('threads');
  });

  it('includes all new fields from SECTION_MAP', () => {
    const args: TemplateArgs = {
      gpu_layers: 32,
      context_size: 8192,
      threads: 16,
      temp: 0.5,
      top_k: 50,
      top_p: 0.9,
      min_p: 0.05,
      typical_p: 1.0,
      repeat_penalty: 1.1,
      repeat_last_n: 64,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      mirostat: 2,
      mirostat_tau: 5.0,
      mirostat_eta: 0.1,
      seed: 42,
      n_predict: 512,
      num_keep: 10,
      rope_freq_scale: 1.0,
      batch_size: 4096,
      cache_reuse: 256,
      no_mmap: false,
      flash_attention: true,
      jinja: true,
      mlock: false,
      rope_scaling: 'yarn',
      rope_freq_base: 1000000,
      logits_all: false,
      embedding: false,
      cont_batching: true,
      cors: true,
      api_key: 'test-key-123',
      speculative: false,
      draft_model: '',
      prompt_cache: '',
      keep_live: 0,
    };
    const result = saveTemplateAsIni(args, '/models/test.gguf');

    // Check sections exist
    expect(result).toContain('[model]');
    expect(result).toContain('[sampling]');
    expect(result).toContain('[performance]');
    expect(result).toContain('[server]');

    // Spot check various values across sections
    expect(result).toContain('gpu-layers = 32');
    expect(result).toContain('ctx-size = 8192');
    expect(result).toContain('temp = 0.5');
    expect(result).toContain('batch-size = 4096');
  });
});

describe('loadTemplateFromIni', () => {
  it('parses basic model settings from INI', () => {
    const ini = `[model]
path = /models/llama-3.2-1b.Q4_K_M.gguf
gpu-layers = 35
ctx-size = 4096
threads = 8
seed = -1

[sampling]
temp = 0.7
top-k = 40
top-p = 0.95`;

    const result = loadTemplateFromIni(ini);

    expect(result.modelPath).toBe('/models/llama-3.2-1b.Q4_K_M.gguf');
    expect(result.args.gpu_layers).toBe(35);
    expect(result.args.context_size).toBe(4096);
    expect(result.args.threads).toBe(8);
    expect(result.args.seed).toBe(-1);
    expect(result.args.temp).toBe(0.7);
    expect(result.args.top_k).toBe(40);
    expect(result.args.top_p).toBe(0.95);
  });

  it('parses boolean values', () => {
    const ini = `[model]
no-mmap = true
flash-attn = false
embedding = true`;

    const result = loadTemplateFromIni(ini);

    expect(result.args.no_mmap).toBe(true);
    expect(result.args.flash_attention).toBe(false);
    expect(result.args.embedding).toBe(true);
  });

  it('parses negative numbers correctly', () => {
    const ini = `[model]
gpu-layers = -1
n-predict = -1`;

    const result = loadTemplateFromIni(ini);

    expect(result.args.gpu_layers).toBe(-1);
    expect(result.args.n_predict).toBe(-1);
  });

  it('parses server settings', () => {
    const ini = `[server]
host = 0.0.0.0
port = 8501
cors = true
api-key = my-secret-key`;

    const result = loadTemplateFromIni(ini);

    expect(result.args.host).toBe('0.0.0.0');
    expect(result.args.port).toBe(8501);
    expect(result.args.cors).toBe(true);
    expect(result.args.api_key).toBe('my-secret-key');
  });

  it('parses performance settings', () => {
    const ini = `[performance]
batch-size = 2048
cache-reuse = 128
cont-batching = true`;

    const result = loadTemplateFromIni(ini);

    expect(result.args.batch_size).toBe(2048);
    expect(result.args.cache_reuse).toBe(128);
    expect(result.args.cont_batching).toBe(true);
  });

  it('parses RoPE settings', () => {
    const ini = `[model]
rope-freq-scale = 2.0
rope-scaling = yarn
rope-freq-base = 500000`;

    const result = loadTemplateFromIni(ini);

    expect(result.args.rope_freq_scale).toBe(2.0);
    expect(result.args.rope_scaling).toBe('yarn');
    expect(result.args.rope_freq_base).toBe(500000);
  });

  it('handles empty INI gracefully', () => {
    const result = loadTemplateFromIni('');
    expect(result.modelPath).toBe('');
    expect(Object.keys(result.args)).toHaveLength(0);
  });

  it('handles comments and blank lines', () => {
    const ini = `# This is a comment
[model]
# Another comment
gpu-layers = 35

; Semicolon comment
ctx-size = 4096`;

    const result = loadTemplateFromIni(ini);

    expect(result.args.gpu_layers).toBe(35);
    expect(result.args.context_size).toBe(4096);
  });

  it('round-trips correctly', () => {
    const args: TemplateArgs = {
      gpu_layers: 32,
      context_size: 8192,
      threads: 16,
      temp: 0.5,
      top_k: 50,
      top_p: 0.9,
      min_p: 0.05,
      repeat_penalty: 1.1,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      seed: 42,
      n_predict: 512,
      batch_size: 4096,
      no_mmap: true,
      flash_attention: false,
      embedding: false,
    };
    const modelPath = '/models/test.gguf';

    // Save to INI
    const ini = saveTemplateAsIni(args, modelPath);
    // Load back
    const result = loadTemplateFromIni(ini);

    expect(result.modelPath).toBe(modelPath);
    expect(result.args.gpu_layers).toBe(32);
    expect(result.args.context_size).toBe(8192);
    expect(result.args.threads).toBe(16);
    expect(result.args.temp).toBe(0.5);
    expect(result.args.top_k).toBe(50);
    expect(result.args.top_p).toBe(0.9);
    expect(result.args.min_p).toBe(0.05);
    expect(result.args.repeat_penalty).toBe(1.1);
    expect(result.args.seed).toBe(42);
    expect(result.args.n_predict).toBe(512);
    expect(result.args.batch_size).toBe(4096);
    expect(result.args.no_mmap).toBe(true);
    expect(result.args.flash_attention).toBe(false);
  });

  it('handles unknown keys by ignoring them', () => {
    const ini = `[model]
unknown-key = some-value
gpu-layers = 35`;

    const result = loadTemplateFromIni(ini);

    // Only known keys should be in args
    expect(result.args.gpu_layers).toBe(35);
    expect('unknown_key' in result.args).toBe(false);
  });
});
