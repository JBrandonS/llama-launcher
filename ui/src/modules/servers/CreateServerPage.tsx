import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Server,
  Cpu,
  Settings,
  AlertCircle,
  Hash,
  Database,
  FileSearch,
  ChevronRight,
  Check,
  Layers,
  ChevronLeft,
  Trash2,
  Play,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import type { LaunchConfig, Settings as AppSettings } from '@services/types';


interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gpu_layers: number;
  context_size: number;
  threads: number;
  max_tokens: number;
  temperature: number;
}

const PRESETS: Preset[] = [
  {
    id: 'low-memory',
    name: 'Low Memory',
    description: 'Minimal VRAM usage, fast context switching',
    icon: Server,
    gpu_layers: 0,
    context_size: 512,
    threads: 2,
    max_tokens: 256,
    temperature: 0.7,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default trade-off between speed and quality',
    icon: Cpu,
    gpu_layers: -1,
    context_size: 4096,
    threads: 4,
    max_tokens: 512,
    temperature: 0.7,
  },
  {
    id: 'high-throughput',
    name: 'High Throughput',
    description: 'Maximum context and token generation',
    icon: Database,
    gpu_layers: -1,
    context_size: 8192,
    threads: 8,
    max_tokens: 1024,
    temperature: 0.7,
  },
  {
    id: 'cpu-only',
    name: 'CPU Only',
    description: 'CPU-only GGUF model (e.g. SmolLM2-1.7B)',
    icon: Settings,
    gpu_layers: 0,
    context_size: 2048,
    threads: 4,
    max_tokens: 512,
    temperature: 0.7,
  },
];

// ─── Validation Error Types ───────────────────────────────────────

interface IdentityErrors {
  name?: string;
  port?: string;
}

interface ModelErrors {
  path?: string;
}

interface RuntimeErrors {
  gpu_layers?: string;
  context_size?: string;
  threads?: string;
  max_tokens?: string;
  temperature?: string;
}

interface StepInfo {
  id: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepInfo[] = [
  { id: 1, label: 'Identity', icon: Server },
  { id: 2, label: 'Model', icon: FileSearch },
  { id: 3, label: 'Runtime', icon: Cpu },
  { id: 4, label: 'Review', icon: Check },
];

// ─── Input Component ──────────────────────────────────────────────

function FormField({
  label,
  error,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── GGUF File Picker ─────────────────────────────────────────────

interface FilePickerProps {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  modelCacheDir?: string;
}

function GGUFFilePicker({ value, onChange, error, modelCacheDir }: FilePickerProps) {
  const [fileList, setFileList] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  const loadGgufFiles = useCallback(async () => {
    if (!modelCacheDir) return;
    setPickerLoading(true);
    try {
      const candidates: string[] = [];
      for (const dir of [modelCacheDir]) {
        const files = await listGgufFiles(dir);
        candidates.push(...files);
      }
      setFileList(candidates);
    } catch {
      setFileList([]);
    } finally {
      setPickerLoading(false);
    }
  }, [modelCacheDir]);

  const handleOpenPicker = async () => {
    setShowPicker(!showPicker);
    if (!showPicker && modelCacheDir && fileList.length === 0) {
      await loadGgufFiles();
    }
  };

  const handleSelectFile = (filePath: string) => {
    onChange(filePath);
    setShowPicker(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <FileSearch className="h-3.5 w-3.5 text-muted-foreground" />
        Model Path
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter GGUF model path or select from cache..."
          className={cn(
            'min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
            error
              ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
              : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
          )}
        />
        {modelCacheDir && (
          <button
            type="button"
            onClick={handleOpenPicker}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            {pickerLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSearch className="h-4 w-4" />
            )}
            Browse
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}

      {showPicker && (
        <div className="mt-1 rounded-md border bg-card p-2 max-h-48 overflow-y-auto">
          {pickerLoading ? (
            <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </div>
          ) : fileList.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No GGUF files found in model cache
            </p>
          ) : (
            <div className="space-y-0.5">
              {fileList.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleSelectFile(f)}
                  className={cn(
                    'w-full rounded px-2 py-1.5 text-left text-sm transition-colors truncate',
                    value === f
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent text-muted-foreground'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!error && modelCacheDir && (
        <p className="text-xs text-muted-foreground">
          Cache directory: {modelCacheDir}
        </p>
      )}
    </div>
  );
}

async function listGgufFiles(cacheDir: string): Promise<string[]> {
  try {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8501';
    const res = await fetch(`${API_BASE}/models`).catch(() => null);
    if (!res) return [];
    const models: Array<{ path: string; id: string }> = await res.json();
    return models
      .filter((m) => m.path && m.path.endsWith('.gguf') && cacheDir && m.path.startsWith(cacheDir))
      .map((m) => m.path);
  } catch {
    return [];
  }
}

// ─── Step 1: Identity ─────────────────────────────────────────────

function IdentityStep({
  name,
  setName,
  port,
  setPort,
  errors,
  setErrors,
  servers,
}: {
  name: string;
  setName: (v: string) => void;
  port: string;
  setPort: (v: string) => void;
  errors: IdentityErrors;
  setErrors: (e: IdentityErrors) => void;
  servers: Array<{ name?: string; port?: number }>;
}) {
  const validate = useCallback(() => {
    const newErrors: IdentityErrors = { name: undefined, port: undefined };
    let hasError = false;

    if (!name.trim()) {
      newErrors.name = 'Server name is required';
      hasError = true;
    } else if (name.length < 3) {
      newErrors.name = 'Server name must be at least 3 characters';
      hasError = true;
    } else {
      const existing = servers.find(
        (s) => s.name?.toLowerCase() === name.trim().toLowerCase()
      );
      if (existing) {
        newErrors.name = 'A server with this name already exists';
        hasError = true;
      }
    }

    if (!port.trim()) {
      newErrors.port = 'Port is required';
      hasError = true;
    } else {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum)) {
        newErrors.port = 'Port must be a number';
        hasError = true;
      } else if (portNum < 1024 || portNum > 65535) {
        newErrors.port = 'Port must be between 1024 and 65535';
        hasError = true;
      } else {
        const conflict = servers.find((s) => s.port === portNum);
        if (conflict) {
          newErrors.port = 'Port already in use by another server';
          hasError = true;
        }
      }
    }

    setErrors(newErrors);
    return !hasError;
  }, [name, port, servers, setErrors]);

  useEffect(() => {
    validate();
  }, [validate]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Server Identity</h2>
        <p className="text-sm text-muted-foreground">
          Give your server a name and assign a port
        </p>
      </div>

      <FormField label="Server Name" icon={Server} error={errors.name} hint="Used to identify this server in the list">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., my-inference-server"
          className={cn(
            'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
            errors.name
              ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
              : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
          )}
        />
      </FormField>

      <FormField label="Port" icon={Hash} error={errors.port} hint="Available range: 1024–65535">
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="e.g., 12345"
          min={1024}
          max={65535}
          className={cn(
            'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
            errors.port
              ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
              : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
          )}
        />
      </FormField>
    </div>
  );
}

// ─── Step 2: Model ────────────────────────────────────────────────

function ModelStep({
  modelPath,
  setModelPath,
  errors,
}: {
  modelPath: string;
  setModelPath: (v: string) => void;
  errors: ModelErrors;
}) {
  const [settings, setSettings] = useState<AppSettings>({});

  useEffect(() => {
    apiService.getSettings().then((s) => {
      setSettings(s);
    });
  }, []);

  const validate = useCallback(() => {
    const newErrors: ModelErrors = { path: undefined };
    let valid = true;

    if (!modelPath.trim()) {
      newErrors.path = 'Model path is required';
      valid = false;
    } else if (!modelPath.endsWith('.gguf')) {
      newErrors.path = 'Model must be a .gguf file';
      valid = false;
    }

    return { valid, errors: newErrors };
  }, [modelPath]);

  useEffect(() => {
    validate();
  }, [validate]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Model Selection</h2>
        <p className="text-sm text-muted-foreground">
          Choose a GGUF model file for inference
        </p>
      </div>

      <GGUFFilePicker
        value={modelPath}
        onChange={setModelPath}
        error={errors.path}
        modelCacheDir={settings.modelCacheDir}
      />
    </div>
  );
}

// ─── Step 3: Runtime ──────────────────────────────────────────────

function RuntimeStep({
  preset,
  onPresetChange,
  gpuLayers,
  setGpuLayers,
  contextSize,
  setContextSize,
  threads,
  setThreads,
  maxTokens,
  setMaxTokens,
  temperature,
  setTemperature,
  errors,
  setErrors,
}: {
  preset: string;
  onPresetChange: (id: string) => void;
  gpuLayers: string;
  setGpuLayers: (v: string) => void;
  contextSize: string;
  setContextSize: (v: string) => void;
  threads: string;
  setThreads: (v: string) => void;
  maxTokens: string;
  setMaxTokens: (v: string) => void;
  temperature: string;
  setTemperature: (v: string) => void;
  errors: RuntimeErrors;
  setErrors: (e: RuntimeErrors) => void;
}) {
  const applyPreset = useCallback(
    (p: Preset) => {
      setGpuLayers(String(p.gpu_layers));
      setContextSize(String(p.context_size));
      setThreads(String(p.threads));
      setMaxTokens(String(p.max_tokens));
      setTemperature(String(p.temperature));
    },
    [setGpuLayers, setContextSize, setThreads, setMaxTokens, setTemperature]
  );

  const handlePresetSelect = (id: string) => {
    onPresetChange(id);
    const p = PRESETS.find((pr) => pr.id === id);
    if (p) applyPreset(p);
  };

  const validate = useCallback(() => {
    const newErrors: RuntimeErrors = {
      gpu_layers: undefined,
      context_size: undefined,
      threads: undefined,
      max_tokens: undefined,
      temperature: undefined,
    };
    let hasError = false;

    const gl = parseInt(gpuLayers, 10);
    if (isNaN(gl)) {
      newErrors.gpu_layers = 'Must be a number (-1 for all layers)';
      hasError = true;
    }

    const cs = parseInt(contextSize, 10);
    if (isNaN(cs)) {
      newErrors.context_size = 'Must be a number';
      hasError = true;
    }

    const th = parseInt(threads, 10);
    if (isNaN(th)) {
      newErrors.threads = 'Must be a number';
      hasError = true;
    }

    const mt = parseInt(maxTokens, 10);
    if (isNaN(mt)) {
      newErrors.max_tokens = 'Must be a number';
      hasError = true;
    }

    const temp = parseFloat(temperature);
    if (isNaN(temp)) {
      newErrors.temperature = 'Must be a number';
      hasError = true;
    }

    setErrors(newErrors);
    return !hasError;
  }, [gpuLayers, contextSize, threads, maxTokens, temperature, setErrors]);

  useEffect(() => {
    validate();
  }, [validate]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Runtime Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure GPU layers, context size, and generation parameters
        </p>
      </div>

    
      <div className="space-y-3">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          Preset Template
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-all',
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-accent hover:bg-accent/30'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span className="font-medium">{p.name}</span>
                  {isActive && <Check className="ml-auto h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    gpu={p.gpu_layers === -1 ? 'all' : p.gpu_layers}
                  </span>
                  <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    ctx={p.context_size}
                  </span>
                  <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    thr={p.threads}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

     
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="GPU Layers" icon={Cpu} error={errors.gpu_layers} hint="-1 for all layers">
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(e.target.value)}
            placeholder="-1"
            className={cn(
              'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
              errors.gpu_layers
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
            )}
          />
        </FormField>

        <FormField label="Context Size" icon={Database} error={errors.context_size} hint="any value">
          <input
            type="number"
            value={contextSize}
            onChange={(e) => setContextSize(e.target.value)}
            placeholder="4096"
            className={cn(
              'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
              errors.context_size
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
            )}
          />
        </FormField>

        <FormField label="Threads" icon={Layers} error={errors.threads} hint="any value">
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(e.target.value)}
            placeholder="4"
            className={cn(
              'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
              errors.threads
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
            )}
          />
        </FormField>

        <FormField label="Max Tokens" icon={Server} error={errors.max_tokens} hint="any value">
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            placeholder="512"
            className={cn(
              'w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors',
              errors.max_tokens
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                : 'focus:border-ring focus:ring-2 focus:ring-ring/20'
            )}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Temperature" icon={Settings} error={errors.temperature} hint="any value">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="flex-1 accent-primary"
            />
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              min={0}
              max={2}
              step={0.1}
              className={cn(
                'w-20 rounded-md border bg-transparent px-2 py-1 text-sm text-right outline-none transition-colors',
                errors.temperature
                  ? 'border-destructive focus:border-destructive'
                  : 'focus:border-ring'
              )}
            />
          </div>
        </FormField>
      </div>
      </div>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────

interface ReviewData {
  name: string;
  port: string;
  modelPath: string;
  preset: string;
  gpuLayers: string;
  contextSize: string;
  threads: string;
  maxTokens: string;
  temperature: string;
}

function ReviewStep({ data }: { data: ReviewData }) {
  const preset = PRESETS.find((p) => p.id === data.preset);

  const configSection: { label: string; rows: { key: string; label: string; value: string }[] }[] = [
    {
      label: 'Identity',
      rows: [
        { key: 'name', label: 'Server Name', value: data.name },
        { key: 'port', label: 'Port', value: String(data.port) },
      ],
    },
    {
      label: 'Model',
      rows: [
        { key: 'model', label: 'Model Path', value: data.modelPath },
      ],
    },
    {
      label: 'Runtime (Preset: ' + (preset?.name || 'Custom') + ')',
      rows: [
        { key: 'gpu', label: 'GPU Layers', value: data.gpuLayers === '-1' ? 'All Layers' : `Layer ${data.gpuLayers}` },
        { key: 'ctx', label: 'Context Size', value: `${data.contextSize} tokens` },
        { key: 'thr', label: 'Threads', value: data.threads },
        { key: 'mt', label: 'Max Tokens', value: data.maxTokens },
        { key: 'temp', label: 'Temperature', value: data.temperature },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Review & Launch</h2>
        <p className="text-sm text-muted-foreground">
          Confirm your server configuration before launching
        </p>
      </div>

      <div className="space-y-4">
        {configSection.map((section) => (
          <div key={section.label} className="rounded-lg border bg-card p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="h-2 w-2 rounded-full bg-primary" />
              {section.label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {section.rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-start justify-between gap-4 rounded-md bg-muted/30 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-medium font-mono">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-muted bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        <p>
          Click <strong className="text-foreground">Launch Server</strong> to start the inference server with the above configuration.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export function CreateServerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [port, setPort] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [preset, setPreset] = useState('balanced');
  const [gpuLayers, setGpuLayers] = useState('-1');
  const [contextSize, setContextSize] = useState('4096');
  const [threads, setThreads] = useState('4');
  const [maxTokens, setMaxTokens] = useState('512');
  const [temperature, setTemperature] = useState('0.7');

  
  const [identityErrors, setIdentityErrors] = useState<IdentityErrors>({ name: undefined, port: undefined });
  const [modelErrors] = useState<ModelErrors>({ path: undefined });
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeErrors>({
    gpu_layers: undefined,
    context_size: undefined,
    threads: undefined,
    max_tokens: undefined,
    temperature: undefined,
  });

  
  const { data: servers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiService.getServers(),
    staleTime: 0,
  });

  
  const launchMutation = useMutation({
    mutationFn: (config: LaunchConfig) => apiService.launchServer(config),
    onSuccess: (data) => {
      toast.success('Server launched', {
        description: data.message || `${name} is running on port ${port}`,
      });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      navigate('/servers');
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Failed to launch server';
      toast.error('Launch failed', {
        description: message,
      });
    },
  });

  const canProceed = (() => {
    switch (step) {
      case 1:
        return identityErrors.name == null && identityErrors.port == null;
      case 2:
        return modelErrors.path == null && modelPath.trim() !== '';
      case 3:
        return (
          runtimeErrors.gpu_layers == null &&
          runtimeErrors.context_size == null &&
          runtimeErrors.threads == null &&
          runtimeErrors.max_tokens == null &&
          runtimeErrors.temperature == null
        );
      default:
        return true;
    }
  })();

  const handleNext = () => {
    if (!canProceed) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleCancel = () => {
    navigate('/servers');
  };

  const handleSubmit = async () => {
 
    const launchConfig: LaunchConfig = {
      model: modelPath.trim(),
      port: parseInt(port, 10),
      args: {
        gpu_layers: parseInt(gpuLayers, 10),
        context_size: parseInt(contextSize, 10),
        threads: parseInt(threads, 10),
        max_tokens: parseInt(maxTokens, 10),
        temperature: parseFloat(temperature),
      },
    };

 
    const validation = await apiService.validateLaunchConfig(launchConfig);
    if (!validation.valid) {
      const firstError = validation.errors[0];
      toast.error('Validation failed', {
        description: firstError.message,
      });
      return;
    }

    launchMutation.mutate(launchConfig);
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        <Link
          to="/servers"
          className="inline-flex items-center gap-1 rounded-md p-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {step === 4 ? 'Review & Launch' : 'Create Server'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure and launch a new inference server
          </p>
        </div>
      </div>

 
      <div className="flex items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  'hidden text-sm sm:inline',
                  isActive ? 'font-medium' : 'text-muted-foreground'
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              )}
            </div>
          );
        })}
      </div>

  
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="min-h-[400px]">
          {step === 1 && (
            <IdentityStep
              name={name}
              setName={setName}
              port={port}
              setPort={setPort}
              errors={identityErrors}
              setErrors={setIdentityErrors}
              servers={servers}
            />
          )}
          {step === 2 && (
             <ModelStep
               modelPath={modelPath}
               setModelPath={setModelPath}
               errors={modelErrors}
             />
           )}
          {step === 3 && (
            <RuntimeStep
              preset={preset}
              onPresetChange={setPreset}
              gpuLayers={gpuLayers}
              setGpuLayers={setGpuLayers}
              contextSize={contextSize}
              setContextSize={setContextSize}
              threads={threads}
              setThreads={setThreads}
              maxTokens={maxTokens}
              setMaxTokens={setMaxTokens}
              temperature={temperature}
              setTemperature={setTemperature}
              errors={runtimeErrors}
              setErrors={setRuntimeErrors}
            />
          )}
          {step === 4 && (
            <ReviewStep
              data={{
                name,
                port,
                modelPath,
                preset,
                gpuLayers,
                contextSize,
                threads,
                maxTokens,
                temperature,
              }}
            />
          )}
        </div>

    
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2">
            {step < 4 && (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors',
                  canProceed
                    ? 'hover:bg-primary/90'
                    : 'cursor-not-allowed opacity-50'
                )}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {step === 4 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={launchMutation.isPending}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors sm:w-auto',
                  launchMutation.isPending
                    ? 'cursor-not-allowed opacity-70'
                    : 'hover:bg-primary/90'
                )}
              >
                {launchMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                {launchMutation.isPending ? 'Launching...' : 'Launch Server'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
