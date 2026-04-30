import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Server, AlertCircle, Cpu, Zap, Braces, Settings2, ChevronDown, FolderOpen } from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import type { ServerInfo, Settings as SettingsType, ValidationError, ModelInfo } from '@services/types';
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
} from '@components/launch/ParameterForm';

interface PresetFormData {
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
}

const DEFAULT_FORM: PresetFormData = {
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
};

function validateForm(
  formData: PresetFormData,
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
];

// ─── Main Component ───────────────────────────────────────────────

export function LaunchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [selectedModelPath, setSelectedModelPath] = useState('');
  const [port, setPort] = useState<number | null>(null);
  const [form, setForm] = useState<PresetFormData>({ ...DEFAULT_FORM });
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <K extends keyof PresetFormData>(key: K, value: PresetFormData[K]) => {
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
      });
    },
    []
  );

  const KNOWN_FORM_FIELDS: Set<keyof PresetFormData> = new Set([
    'gpu_layers', 'context_size', 'threads', 'temp', 'top_k', 'top_p',
    'min_p', 'typical_p', 'penalty_range', 'repeat_penalty', 'repeat_last_n',
    'presence_penalty', 'frequency_penalty', 'mirostat', 'mirostat_tau',
    'mirostat_eta', 'seed', 'n_predict', 'num_keep', 'rope_freq_scale',
    'grammar_file', 'batch_size', 'cache_reuse',
  ]);

  const applyTemplateArgs = useCallback((template: ReturnType<typeof TemplateLoader.getDefaultTemplate>) => {
    if (!template) return;
    const args = template.args;

    const newForm: Partial<PresetFormData> = {};

    for (const [key, value] of Object.entries(args)) {
      if (KNOWN_FORM_FIELDS.has(key as keyof PresetFormData)) {
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
      </div>

    <div className="flex justify-end">
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
  );
}
