import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Server, AlertCircle, Cpu, Zap, Braces, Settings2, ChevronDown, FolderOpen, Download, Sparkles, Globe, Terminal, Copy, Loader2 } from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import type { ServerInfo, Settings as SettingsType, ValidationError, ModelInfo, QuantizationInfo } from '@services/types';
import { PresetsManager } from '@components/launch/PresetsManager';
import type { Preset } from '@components/launch/PresetsManager';
import { TemplateSelector } from '@components/launch/TemplateSelector';
import { TemplateLoader } from '@utils/templateLoader';
import {
  CollapsibleSection,
  type SectionDef,
  SliderInput,
  NumberInput,
  SelectInput,
  Toggle,
} from '@components/launch/ParameterForm';

interface LaunchFormState {
  gpu_layers: number;
  context_size: number;
  threads: number;
  temp: number;
  top_k: number;
  top_p: number;
  min_p: number;
  typical_p: number;
  penalty_range: number;
  repeat_penalty: number;
  repeat_last_n: number;
  presence_penalty: number;
  frequency_penalty: number;
  mirostat: number;
  mirostat_tau: number;
  mirostat_eta: number;
  seed: number;
  n_predict: number;
  num_keep: number;
  rope_freq_scale: number;
  grammar_file: string;
  batch_size: number;
  cache_reuse: number;

  // New fields
  host: string;
  cors: boolean;
  cors_allow_origin: string;
  api_key: string;
  flash_attn: string; // "on" | "off" | "auto"
  no_mmap: boolean;
  mlock: boolean;
  numa: string; // "distribute" | "isolate" | "numactl"
  cont_batching: boolean;
  rope_scaling: string; // "none" | "linear" | "yarn"
  rope_freq_base: number;
  embedding: boolean;
  logits_all: boolean;
  speculative: boolean;
  draft_model: string;
  prompt_cache: string;
  keep_live: number;
}

const DEFAULT_FORM: LaunchFormState = {
  gpu_layers: -1,
  context_size: 0,
  threads: 0,
  temp: 0.8,
  top_k: 40,
  top_p: 0.95,
  min_p: 0.05,
  typical_p: 1.0,
  penalty_range: 64,
  repeat_penalty: 1.1,
  repeat_last_n: 0,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  mirostat: 0,
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
  seed: -1,
  n_predict: 256,
  num_keep: -1,
  rope_freq_scale: 1.0,
  grammar_file: '',
  batch_size: 2048,
  cache_reuse: 0,

  // New defaults
  host: '127.0.0.1',
  cors: false,
  cors_allow_origin: '',
  api_key: '',
  flash_attn: 'auto',
  no_mmap: false,
  mlock: false,
  numa: '',
  cont_batching: false,
  rope_scaling: 'none',
  rope_freq_base: 1000000,
  embedding: false,
  logits_all: false,
  speculative: false,
  draft_model: '',
  prompt_cache: '',
  keep_live: 0,
};

function validateForm(
  formData: LaunchFormState,
  modelPath: string,
  port: number | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!modelPath.trim()) {
    errors.push({ field: 'model', message: 'Model path is required' });
  }
  if (port !== null && port !== undefined) {
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push({ field: 'port', message: 'Port must be between 1 and 65535' });
    }
    if (port < 1024 && port !== null && port !== undefined) {
      errors.push({ field: 'port', message: 'Port should be >= 1024' });
    }
  }
  if (formData.temp < 0 || formData.temp > 2) {
    errors.push({ field: 'temp', message: 'Temperature must be between 0 and 2' });
  }
  if (formData.context_size < 0 || formData.context_size > 131072) {
    errors.push({ field: 'context_size', message: 'Context size must be between 0 and 131072' });
  }
  if (formData.threads < 0 || formData.threads > 128) {
    errors.push({ field: 'threads', message: 'Threads must be between 0 and 128 (0 = auto-detect)' });
  }
  if (formData.top_k < 1 || formData.top_k > 1000) {
    errors.push({ field: 'top_k', message: 'Top-k must be between 1 and 1000' });
  }
  if (formData.top_p < 0 || formData.top_p > 1) {
    errors.push({ field: 'top_p', message: 'Top-p must be between 0 and 1' });
  }
  if (formData.min_p < 0 || formData.min_p > 1) {
    errors.push({ field: 'min_p', message: 'Min-p must be between 0 and 1' });
  }
  if (formData.repeat_penalty < 0 || formData.repeat_penalty > 2) {
    errors.push({ field: 'repeat_penalty', message: 'Repeat penalty must be between 0 and 2' });
  }
  if (formData.n_predict < -1 || formData.n_predict > 4096) {
    errors.push({ field: 'n_predict', message: 'Num predict must be between -1 and 4096 (-1 = unlimited)' });
  }
  if (formData.seed < -1) {
    errors.push({ field: 'seed', message: 'Seed must be >= -1' });
  }
  // New field validations
  if (formData.host && !/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$/.test(formData.host) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(formData.host)) {
    errors.push({ field: 'host', message: 'Invalid host address' });
  }
  if (formData.cors_allow_origin && formData.cors_allow_origin !== '*' && !/^https?:\/\//.test(formData.cors_allow_origin)) {
    errors.push({ field: 'cors_allow_origin', message: 'CORS origin must start with http:// or https:// or be *' });
  }
  if (formData.rope_freq_base < 0) {
    errors.push({ field: 'rope_freq_base', message: 'RoPE freq base must be non-negative' });
  }
  if (formData.keep_live < 0) {
    errors.push({ field: 'keep_live', message: 'Keep live must be non-negative' });
  }

  return errors;
}

const PARAMETER_SECTIONS: SectionDef[] = [
  {
    id: 'model-gpu',
    title: 'Model & GPU',
    description: 'GPU layers, context size, threads',
    icon: (props) => <Cpu className={cn(props.className)} />,
  },
  {
    id: 'sampling',
    title: 'Sampling',
    description: 'Temperature, top-k, top-p, repetition',
    icon: (props) => <Zap className={cn(props.className)} />,
  },
  {
    id: 'context',
    title: 'Context',
    description: 'Sequence length, KV cache, tokens to keep',
    icon: (props) => <Braces className={cn(props.className)} />,
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Mirostat, grammar, batch size, rope scale',
    icon: (props) => <Settings2 className={cn(props.className)} />,
  },
  {
    id: 'network',
    title: 'Network',
    description: 'Host, CORS, API key',
    icon: (props) => <Globe className={cn(props.className)} />,
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Flash attention, memory, NUMA',
    icon: (props) => <Zap className={cn(props.className)} />,
  },
  {
    id: 'rope',
    title: 'RoPE',
    description: 'Frequency scaling, YaRN',
    icon: (props) => <Settings2 className={cn(props.className)} />,
  },
  {
    id: 'advanced-2',
    title: 'Advanced',
    description: 'Embedding, speculative, cache',
    icon: (props) => <Cpu className={cn(props.className)} />,
  },
];

// ─── Known aliases for suggestions ───────────────────────────────
const KNOWN_ALIASES: Record<string, string> = {
  'qwen3.6-35b': 'Qwen/Qwen3.6-35B-A4-Band-GGUF',
  'qwen3.6': 'Qwen/Qwen3.6-35B-A4-Band-GGUF',
  'llama3.2-1b': 'huggingface/llama3.2-1b-GGUF',
  'tinyllama': 'TinyLlama/TinyLlama-1.1B-Chat-v1.0-GGUF',
  'embeddinggemma': 'google/gemma-3-1b-it-GGUF',
  'qwen3-reranker': 'Qwen/Qwen3-Reranker-8B-A4.2B-GGUF',
};

// ─── Main Component ───────────────────────────────────────────────

export function LaunchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [selectedModelPath, setSelectedModelPath] = useState('');
  const [port, setPort] = useState<number | null>(null);
  const [form, setForm] = useState<LaunchFormState>({ ...DEFAULT_FORM });
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── HuggingFace model input ──────────────────────────────────
  const [hfModelInput, setHfModelInput] = useState('');
  const [resolvedModel, setResolvedModel] = useState<string | null>(null);
  const [quantizations, setQuantizations] = useState<QuantizationInfo[]>([]);
  const [selectedQuantization, setSelectedQuantization] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const hfInputRef = useRef<HTMLInputElement>(null);
  const [previewCommand, setPreviewCommand] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const getPreview = useCallback(async () => {
    if (!selectedModelPath) {
      setPreviewCommand(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await apiService.getLaunchPreview(selectedModelPath, form as unknown as Record<string, unknown>);
      setPreviewCommand(result.command);
    } catch {
      setPreviewCommand(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedModelPath, form]);

  useEffect(() => {
    const timer = setTimeout(getPreview, 300);
    return () => clearTimeout(timer);
  }, [getPreview]);

  const copyCommand = useCallback(() => {
    if (!previewCommand) return;
    navigator.clipboard.writeText(previewCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [previewCommand]);

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiService.getServers(),
    staleTime: 60_000,
    retry: 2,
  });

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: () => apiService.getSettings(),
    staleTime: 60_000,
    retry: 2,
  });

  const { data: fetchedModels = [] } = useQuery({
    queryKey: ['models'],
    queryFn: () => apiService.getModels(),
    staleTime: 60_000,
    retry: 2,
  });

  useEffect(() => {
    setModels(fetchedModels);
  }, [fetchedModels]);

  // ── Resolve alias + fetch quantizations when HF model input changes ─
  useEffect(() => {
    const input = hfModelInput.trim();
    if (!input) {
      setResolvedModel(null);
      setQuantizations([]);
      setSelectedQuantization('');
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      try {
        // Try resolving as alias first
        const resolved = await apiService.resolveAlias(input);
        if (resolved) {
          setResolvedModel(resolved.resolved);
          // Fetch quantizations for the resolved model
          const quantData = await apiService.getModelQuantizations(resolved.resolved);
          if (quantData?.quantizations) {
            setQuantizations(quantData.quantizations);
            // Auto-select recommended
            const recommended = quantData.quantizations.find((q: QuantizationInfo) => q.isRecommended);
            if (recommended) {
              setSelectedQuantization(recommended.tag);
            }
          }
        } else {
          // Not an alias — treat as HF identifier directly
          setResolvedModel(input);
          const quantData = await apiService.getModelQuantizations(input);
          if (quantData?.quantizations) {
            setQuantizations(quantData.quantizations);
            const recommended = quantData.quantizations.find((q: QuantizationInfo) => q.isRecommended);
            if (recommended) {
              setSelectedQuantization(recommended.tag);
            }
          }
        }
      } catch {
        setResolvedModel(null);
        setQuantizations([]);
      } finally {
        setIsResolving(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [hfModelInput]);

  // ── Handle model selection from HF + quantization ──
  const handleHfModelSelect = useCallback(async () => {
    if (!resolvedModel || !selectedQuantization) return;
    setIsDownloading(true);
    setDownloadProgress('Starting download...');
    try {
      const result = await apiService.downloadModel({
        model: resolvedModel,
        quantization: selectedQuantization,
      });
      if (result?.status === 'success' || result?.message?.includes('Downloaded successfully')) {
        setDownloadProgress('Download complete!');
        // Refresh model list
        await queryClient.invalidateQueries({ queryKey: ['models'] });
        toast.success('Model downloaded', {
          description: `${resolvedModel} (${selectedQuantization}) is now available.`,
        });
        // Clear HF state
        setHfModelInput('');
        setResolvedModel(null);
        setQuantizations([]);
        setSelectedQuantization('');
        setDownloadProgress('');
      } else {
        setDownloadProgress(result?.message || 'Download failed');
        toast.error('Download failed', { description: result?.message || 'Unknown error' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setDownloadProgress(message);
      toast.error('Download failed', { description: message });
    } finally {
      setIsDownloading(false);
    }
  }, [resolvedModel, selectedQuantization, queryClient]);

  const existingPorts = useMemo(
    () => new Set((servers ?? []).map((s: ServerInfo) => s.port ?? 0).filter((p) => p > 0)),
    [servers]
  );

  useEffect(() => {
    const path = searchParams.get('path');
    const p = searchParams.get('port');
    if (path) setSelectedModelPath(path);
    if (p) setPort(parseInt(p, 10));
  }, [searchParams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-model-dropdown]')) {
        setModelDropdownOpen(false);
      }
    }

    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [modelDropdownOpen]);

  const updateField = useCallback(
    <K extends keyof LaunchFormState>(key: K, value: LaunchFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const applyPreset = useCallback(
    (preset: Preset) => {
      setSelectedPreset(preset.id);
      const {
        gpu_layers = DEFAULT_FORM.gpu_layers,
        context_size = DEFAULT_FORM.context_size,
        threads = DEFAULT_FORM.threads,
        temp = DEFAULT_FORM.temp,
        top_k = DEFAULT_FORM.top_k,
        top_p = DEFAULT_FORM.top_p,
        min_p = DEFAULT_FORM.min_p,
        typical_p = DEFAULT_FORM.typical_p,
        penalty_range = DEFAULT_FORM.penalty_range,
        repeat_penalty = DEFAULT_FORM.repeat_penalty,
        repeat_last_n = DEFAULT_FORM.repeat_last_n,
        presence_penalty = DEFAULT_FORM.presence_penalty,
        frequency_penalty = DEFAULT_FORM.frequency_penalty,
        mirostat = DEFAULT_FORM.mirostat,
        mirostat_tau = DEFAULT_FORM.mirostat_tau,
        mirostat_eta = DEFAULT_FORM.mirostat_eta,
        seed = DEFAULT_FORM.seed,
        n_predict = DEFAULT_FORM.n_predict,
        num_keep = DEFAULT_FORM.num_keep,
        rope_freq_scale = DEFAULT_FORM.rope_freq_scale,
        grammar_file = DEFAULT_FORM.grammar_file,
        batch_size = DEFAULT_FORM.batch_size,
        cache_reuse = DEFAULT_FORM.cache_reuse,
        host = DEFAULT_FORM.host,
        cors = DEFAULT_FORM.cors,
        cors_allow_origin = DEFAULT_FORM.cors_allow_origin,
        api_key = DEFAULT_FORM.api_key,
        flash_attn = DEFAULT_FORM.flash_attn,
        no_mmap = DEFAULT_FORM.no_mmap,
        mlock = DEFAULT_FORM.mlock,
        numa = DEFAULT_FORM.numa,
        cont_batching = DEFAULT_FORM.cont_batching,
        rope_scaling = DEFAULT_FORM.rope_scaling,
        rope_freq_base = DEFAULT_FORM.rope_freq_base,
        embedding = DEFAULT_FORM.embedding,
        logits_all = DEFAULT_FORM.logits_all,
        speculative = DEFAULT_FORM.speculative,
        draft_model = DEFAULT_FORM.draft_model,
        prompt_cache = DEFAULT_FORM.prompt_cache,
        keep_live = DEFAULT_FORM.keep_live,
      } = preset.values;

      setForm({
        gpu_layers,
        context_size,
        threads,
        temp,
        top_k,
        top_p,
        min_p,
        typical_p,
        penalty_range,
        repeat_penalty,
        repeat_last_n,
        presence_penalty,
        frequency_penalty,
        mirostat,
        mirostat_tau,
        mirostat_eta,
        seed,
        n_predict,
        num_keep,
        rope_freq_scale,
        grammar_file,
        batch_size,
        cache_reuse,
        host,
        cors,
        cors_allow_origin,
        api_key,
        flash_attn,
        no_mmap,
        mlock,
        numa,
        cont_batching,
        rope_scaling,
        rope_freq_base,
        embedding,
        logits_all,
        speculative,
        draft_model,
        prompt_cache,
        keep_live,
      });
    },
    []
  );

  const KNOWN_FORM_FIELDS: Set<keyof LaunchFormState> = new Set([
    'gpu_layers', 'context_size', 'threads', 'temp', 'top_k', 'top_p',
    'min_p', 'typical_p', 'penalty_range', 'repeat_penalty', 'repeat_last_n',
    'presence_penalty', 'frequency_penalty', 'mirostat', 'mirostat_tau',
    'mirostat_eta', 'seed', 'n_predict', 'num_keep', 'rope_freq_scale',
    'grammar_file', 'batch_size', 'cache_reuse',
    'host', 'cors', 'cors_allow_origin', 'api_key', 'flash_attn',
    'no_mmap', 'mlock', 'numa', 'cont_batching', 'rope_scaling',
    'rope_freq_base', 'embedding', 'logits_all', 'speculative',
    'draft_model', 'prompt_cache', 'keep_live',
  ]);

  const applyTemplateArgs = useCallback((template: ReturnType<typeof TemplateLoader.getDefaultTemplate>) => {
    if (!template) return;
    const args = template.args;

    const newForm: Partial<LaunchFormState> = {};

    for (const [key, value] of Object.entries(args)) {
      if (KNOWN_FORM_FIELDS.has(key as keyof LaunchFormState)) {
        (newForm as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(newForm).length > 0) {
      setForm((prev) => ({ ...prev, ...newForm }));
    }

    if (args.port !== undefined) {
      setPort(args.port);
    }

    TemplateLoader.saveLastUsed(selectedModelPath, template.id);
  }, [selectedModelPath]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = TemplateLoader.templates.find((t) => t.id === templateId);
    if (template) {
      applyTemplateArgs(template);
    }
  }, [applyTemplateArgs]);

  useEffect(() => {
    if (!selectedModelPath) {
      setSelectedTemplateId('');
      setPort(null);
      setForm({ ...DEFAULT_FORM });
      return;
    }

    const template = TemplateLoader.getDefaultTemplate(selectedModelPath);
    if (template) {
      setSelectedTemplateId(template.id);
      applyTemplateArgs(template);
    } else {
      setSelectedTemplateId('');
    }
  }, [selectedModelPath, applyTemplateArgs]);

  const launchMutation = useMutation({
    mutationFn: async (config: Parameters<typeof apiService.launchServer>[0]) =>
      apiService.launchServer(config),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server launched', {
        description: `Server ${data.serverId} started successfully.`,
      });
      navigate('/servers');
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Failed to launch server';
      toast.error('Launch failed', { description: message });
    },
  });

  const launchMutationRef = useRef(launchMutation);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateForm(form, selectedModelPath, port);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      toast.error('Validation errors', {
        description: 'Please fix the errors before launching.',
      });
      return;
    }

    const config = {
      model: selectedModelPath,
      port: port || (settings?.apiPort ?? 8501),
      args: {
        ...form,
      },
      env: {},
    };

    // Client-side passed; now do backend validation too
    try {
      const backendValidation = await apiService.validateLaunchConfig(config);
      if (!backendValidation.valid) {
        setValidationErrors(backendValidation.errors);
        setErrors(validationErrors);
        toast.error('Backend validation failed', {
          description: 'Please review the errors.',
        });
        return;
      }
    } catch {
      // proceed with client validation only
    }

    setErrors([]);
    setValidationErrors([]);
    launchMutationRef.current.mutate(config);
  }, [form, selectedModelPath, port, settings]);

  const displayPort = port ?? (settings?.apiPort ?? 8501);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Launch Server</h1>
          <p className="text-sm text-muted-foreground">
            Configure and launch an inference server
          </p>
        </div>
      </div>

{(errors.length > 0 || validationErrors.length > 0) && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Please fix the following errors
              </p>
              <ul className="list-inside list-disc text-xs text-destructive/80">
                {[...errors, ...validationErrors].map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

  <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Model & Port</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Model</label>
            <div className="flex gap-2" data-model-dropdown>
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className={cn(
                    'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
                    'focus:border-ring focus:ring-2 focus:ring-ring/20',
                    'flex items-center justify-between text-left',
                    !selectedModelPath && 'text-muted-foreground'
                  )}
                >
                  <span className="truncate">
                    {selectedModelPath
                      ? selectedModelPath.split('/').pop()
                      : 'Select a model...'}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-card shadow-lg">
                    {models.length > 0 ? (
                      models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModelPath(model.path);
                            setModelDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                            model.path === selectedModelPath && 'bg-accent'
                          )}
                        >
                          <div className="font-medium truncate">{model.path.split('/').pop()}</div>
                          <div className="text-xs text-muted-foreground truncate">{model.path}</div>
                          <div className="text-xs text-muted-foreground">{model.size_human}</div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground">No local models found</div>
                    )}
                  </div>
                )}
              </div>

              <input
                type="file"
                accept=".gguf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Browser security: full path not exposed; use webkitRelativePath (non-standard) or name
                    const fullPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
                    setSelectedModelPath(fullPath);
                  }
                  e.target.value = '';
                }}
                className="hidden"
                ref={fileInputRef}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
                  'hover:bg-accent flex items-center gap-2'
                )}
                title="Select GGUF file from disk"
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Browse</span>
              </button>
            </div>
          </div>

          {/* ── HuggingFace model download section ── */}
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              Or add from HuggingFace
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={hfInputRef}
                  type="text"
                  value={hfModelInput}
                  onChange={(e) => {
                    setHfModelInput(e.target.value);
                    setDownloadProgress('');
                  }}
                  placeholder="e.g. qwen3.6-35b or meta-llama/Llama-3.2-1B"
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors
                    focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground"
                />
                {isResolving && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  </div>
                )}
              </div>
              {resolvedModel && quantizations.length > 0 && (
                <button
                  type="button"
                  onClick={handleHfModelSelect}
                  disabled={isDownloading || !selectedQuantization}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors',
                    'hover:bg-primary/90',
                    (isDownloading || !selectedQuantization) && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {isDownloading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      <span className="hidden sm:inline">{downloadProgress || 'Downloading...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* ── Resolved model info ── */}
            {resolvedModel && !isResolving && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Resolved:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5">{resolvedModel}</code>
                </div>

                {/* ── Quantization selector ── */}
                {quantizations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Quantization:</span>
                    <div className="flex flex-wrap gap-1">
                      {quantizations.map((q: QuantizationInfo) => (
                        <button
                          key={q.tag}
                          type="button"
                          onClick={() => setSelectedQuantization(q.tag)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                            selectedQuantization === q.tag
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border bg-transparent hover:bg-accent'
                          )}
                        >
                          {q.tag}
                          {q.isRecommended && (
                            <span className="text-[10px] text-muted-foreground">recommended</span>
                          )}
                          {q.size && (
                            <span className="text-[10px] text-muted-foreground">{q.size}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Alias suggestion ── */}
            {!resolvedModel && !isResolving && hfModelInput.trim() && (
              <div className="mt-2 text-xs text-muted-foreground">
                No alias found for &ldquo;{hfModelInput}&rdquo;. Try:{' '}
                {Object.entries(KNOWN_ALIASES).slice(0, 3).map(([k], i, arr) => (
                  <span key={k}>
                    <button
                      type="button"
                      onClick={() => setHfModelInput(k)}
                      className="text-violet-400 hover:underline"
                    >
                      {k}
                    </button>
                    {i < arr.length - 1 && ', '}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2">
          <NumberInput
            label="Port"
            value={displayPort}
            onChange={(v) => {
              const num = parseInt(String(v), 10);
              setPort(isNaN(num) ? null : num);
            }}
            min={1024}
            max={65535}
            hint={
              existingPorts.has(displayPort)
                ? 'Port already in use by another server'
                : `API will listen on port ${displayPort}`
            }
          />
        </div>
        <TemplateSelector
          modelPath={selectedModelPath}
          selectedTemplateId={selectedTemplateId}
          onTemplateSelect={handleTemplateSelect}
        />

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={launchMutation.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors',
              'hover:bg-primary/90',
              launchMutation.isPending && 'cursor-not-allowed opacity-50'
            )}
          >
            {launchMutation.isPending ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Launching...
              </>
            ) : (
              <>
                <Server className="h-4 w-4" />
                Launch Server
              </>
            )}
          </button>
        </div>
      </div>

   <PresetsManager
        selectedPreset={selectedPreset}
        onPresetChange={setSelectedPreset}
        onApplyPreset={applyPreset}
      />

    <div className="space-y-4">
        <CollapsibleSection section={PARAMETER_SECTIONS[0]}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SliderInput
              label="GPU Layers"
              value={form.gpu_layers}
              onChange={(v) => updateField('gpu_layers', v)}
              min={-1}
              max={100}
              step={1}
              hint="Use -1 to offload all layers to GPU"
            />
            <SliderInput
              label="Context Size"
              value={form.context_size}
              onChange={(v) => updateField('context_size', v)}
              min={0}
              max={131072}
              step={128}
              hint="Number of tokens in context window (0 = model default)"
            />
            <NumberInput
              label="Threads"
              value={form.threads}
              onChange={(v) => updateField('threads', Math.round(parseFloat(String(v))) || 0)}
              min={0}
              max={128}
              hint="CPU threads for inference (0 = auto-detect)"
            />
          </div>
        </CollapsibleSection>

 <CollapsibleSection section={PARAMETER_SECTIONS[1]}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SliderInput
              label="Temperature"
              value={form.temp}
              onChange={(v) => updateField('temp', v)}
              min={0}
              max={2}
              step={0.05}
              hint="0 = deterministic, 1 = creative"
            />
            <SliderInput
              label="Top-K"
              value={form.top_k}
              onChange={(v) => updateField('top_k', v)}
              min={1}
              max={1000}
              step={1}
              hint="Sample from top K tokens"
            />
            <SliderInput
              label="Top-P"
              value={form.top_p}
              onChange={(v) => updateField('top_p', v)}
              min={0}
              max={1}
              step={0.01}
              hint="Nucleus sampling threshold"
            />
            <SliderInput
              label="Min-P"
              value={form.min_p}
              onChange={(v) => updateField('min_p', v)}
              min={0}
              max={1}
              step={0.01}
              hint="Minimum probability threshold"
            />
            <SliderInput
              label="Repeat Penalty"
              value={form.repeat_penalty}
              onChange={(v) => updateField('repeat_penalty', v)}
              min={0}
              max={2}
              step={0.01}
              hint="Penalty for repeated tokens"
            />
            <NumberInput
              label="Repeat Last N"
              value={form.repeat_last_n}
              onChange={(v) => updateField('repeat_last_n', Math.round(parseFloat(String(v))) || 64)}
              min={-1}
              max={256}
              hint="Number of tokens to check for repeats (-1 = context)"
            />
            <SliderInput
              label="Presence Penalty"
              value={form.presence_penalty}
              onChange={(v) => updateField('presence_penalty', v)}
              min={-2}
              max={2}
              step={0.01}
              hint="Penalize tokens that already appeared"
            />
            <SliderInput
              label="Frequency Penalty"
              value={form.frequency_penalty}
              onChange={(v) => updateField('frequency_penalty', v)}
              min={-2}
              max={2}
              step={0.01}
              hint="Penalize tokens based on frequency"
            />
            <SliderInput
              label="Typical P"
              value={form.typical_p}
              onChange={(v) => updateField('typical_p', v)}
              min={0}
              max={1}
              step={0.01}
              hint="Locally typical sampling parameter"
            />
          </div>
        </CollapsibleSection>

  <CollapsibleSection section={PARAMETER_SECTIONS[2]}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SliderInput
              label="Num Predict"
              value={form.n_predict}
              onChange={(v) => updateField('n_predict', v)}
              min={-1}
              max={4096}
              step={1}
              hint="Maximum tokens to generate (-1 = unlimited)"
            />
            <NumberInput
              label="Num Keep"
              value={form.num_keep}
              onChange={(v) => updateField('num_keep', Math.round(parseFloat(String(v))) || -1)}
              min={-1}
              hint="Number of tokens to keep from system prompt (-1 = all)"
            />
          </div>
        </CollapsibleSection>

    <CollapsibleSection section={PARAMETER_SECTIONS[3]}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectInput
              label="Mirostat"
              value={String(form.mirostat)}
              onChange={(v) => updateField('mirostat', parseInt(v, 10) || 0)}
              options={[
                { value: '0', label: 'Off' },
                { value: '1', label: 'Mirostat v1' },
                { value: '2', label: 'Mirostat v2' },
              ]}
              hint="Automatically tune learning rate"
            />
            <SliderInput
              label="Mirostat Tau"
              value={form.mirostat_tau}
              onChange={(v) => updateField('mirostat_tau', v)}
              min={0}
              max={10}
              step={0.1}
              hint="Target entropy for Mirostat"
            />
            <SliderInput
              label="Mirostat Eta"
              value={form.mirostat_eta}
              onChange={(v) => updateField('mirostat_eta', v)}
              min={0}
              max={1}
              step={0.01}
              hint="Learning rate for Mirostat"
            />
            <NumberInput
              label="Seed"
              value={form.seed}
              onChange={(v) => updateField('seed', Math.round(parseFloat(String(v))) || -1)}
              min={-1}
              max={2147483647}
              hint="-1 for random seed"
            />
            <NumberInput
              label="Batch Size"
              value={form.batch_size}
              onChange={(v) => updateField('batch_size', Math.round(parseFloat(String(v))) || 512)}
              min={1}
              max={8192}
              hint="Processing batch size"
            />
            <NumberInput
              label="Cache Reuse"
              value={form.cache_reuse}
              onChange={(v) => updateField('cache_reuse', Math.round(parseFloat(String(v))) || 0)}
              min={0}
              max={8192}
              hint="KV cache reuse length"
            />
            <SliderInput
              label="RoPE Freq Scale"
              value={form.rope_freq_scale}
              onChange={(v) => updateField('rope_freq_scale', v)}
              min={0.1}
              max={5}
              step={0.05}
              hint="RoPE frequency scaling factor"
            />
            <NumberInput
              label="Penalty Range"
              value={form.penalty_range}
              onChange={(v) => updateField('penalty_range', Math.round(parseFloat(String(v))) || 10)}
              min={0}
              max={256}
              hint="Range for penalty application"
            />
            <NumberInput
              label="Grammar File"
              value={form.grammar_file}
              onChange={(v) => updateField('grammar_file', String(v))}
              placeholder=""
              hint="Path to GGJL grammar file"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection section={PARAMETER_SECTIONS[4]}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput
              label="Host"
              value={form.host}
              onChange={(v) => updateField('host', v)}
              options={[
                { value: '127.0.0.1', label: '127.0.0.1 (localhost)' },
                { value: '0.0.0.0', label: '0.0.0.0 (all interfaces)' },
              ]}
              hint="Bind address for the server"
            />
            <Toggle
              label="CORS"
              checked={form.cors}
              onChange={(v) => updateField('cors', v)}
              hint="Enable Cross-Origin Resource Sharing"
            />
            <NumberInput
              label="CORS Allow Origin"
              value={form.cors_allow_origin}
              onChange={(v) => updateField('cors_allow_origin', String(v))}
              placeholder="*"
              hint="Allowed origin (e.g. https://example.com or *)"
            />
            <NumberInput
              label="API Key"
              value={form.api_key}
              onChange={(v) => updateField('api_key', String(v))}
              placeholder=""
              hint="Optional API key for authentication"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection section={PARAMETER_SECTIONS[5]}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectInput
              label="Flash Attention"
              value={form.flash_attn}
              onChange={(v) => updateField('flash_attn', v)}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
              hint="Enable flash attention (auto = detect)"
            />
            <Toggle
              label="No MMAP"
              checked={form.no_mmap}
              onChange={(v) => updateField('no_mmap', v)}
              hint="Disable memory mapping for model loading"
            />
            <Toggle
              label="MLOCK"
              checked={form.mlock}
              onChange={(v) => updateField('mlock', v)}
              hint="Lock model in RAM to prevent swapping"
            />
            <SelectInput
              label="NUMA"
              value={form.numa}
              onChange={(v) => updateField('numa', v)}
              options={[
                { value: '', label: 'Off' },
                { value: 'distribute', label: 'Distribute' },
                { value: 'isolate', label: 'Isolate' },
                { value: 'numactl', label: 'Numactl' },
              ]}
              hint="NUMA node binding strategy"
            />
            <Toggle
              label="Continuous Batching"
              checked={form.cont_batching}
              onChange={(v) => updateField('cont_batching', v)}
              hint="Enable continuous batching for higher throughput"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection section={PARAMETER_SECTIONS[6]}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput
              label="RoPE Scaling"
              value={form.rope_scaling}
              onChange={(v) => updateField('rope_scaling', v)}
              options={[
                { value: 'none', label: 'None' },
                { value: 'linear', label: 'Linear' },
                { value: 'yarn', label: 'YaRN (Yet another RoPE scaling)' },
              ]}
              hint="RoPE frequency scaling method for extended context"
            />
            <NumberInput
              label="RoPE Freq Base"
              value={form.rope_freq_base}
              onChange={(v) => updateField('rope_freq_base', Math.round(parseFloat(String(v))) || 1000000)}
              min={1}
              max={10000000}
              hint="RoPE frequency base (NTK-aware scaling)"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection section={PARAMETER_SECTIONS[7]}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle
              label="Embedding Mode"
              checked={form.embedding}
              onChange={(v) => updateField('embedding', v)}
              hint="Enable embedding mode for vector representations"
            />
            <Toggle
              label="Logits All"
              checked={form.logits_all}
              onChange={(v) => updateField('logits_all', v)}
              hint="Return logits for all tokens, not just the last one"
            />
            <Toggle
              label="Speculative Decoding"
              checked={form.speculative}
              onChange={(v) => updateField('speculative', v)}
              hint="Enable speculative decoding with a draft model"
            />
            <NumberInput
              label="Draft Model"
              value={form.draft_model}
              onChange={(v) => updateField('draft_model', String(v))}
              placeholder=""
              hint="Path to draft model for speculative decoding"
            />
            <NumberInput
              label="Prompt Cache"
              value={form.prompt_cache}
              onChange={(v) => updateField('prompt_cache', String(v))}
              placeholder=""
              hint="Path to prompt cache file for persistent context"
            />
            <NumberInput
              label="Keep Live"
              value={form.keep_live}
              onChange={(v) => updateField('keep_live', Math.round(parseFloat(String(v))) || 0)}
              min={0}
              max={3600}
              hint="Keep model loaded for N seconds after request (0 = immediate unload)"
            />
          </div>
        </CollapsibleSection>

        {/* Command Preview */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Command Preview</h3>
            </div>
            {previewCommand && (
              <button
                type="button"
                onClick={copyCommand}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Copy command"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating...
            </div>
          ) : previewCommand ? (
            <code className="block max-h-32 overflow-auto rounded-md bg-background p-3 text-xs leading-relaxed text-foreground">
              {previewCommand}
            </code>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedModelPath ? 'No non-default arguments to display.' : 'Select a model to see the command preview.'}
            </p>
          )}
          {copied && (
            <p className="mt-2 text-xs text-emerald-500">Command copied to clipboard</p>
          )}
        </div>
      </div>
    </div>
  );
}
