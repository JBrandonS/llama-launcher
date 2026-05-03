import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@services/apiService';
import { ModelInfo } from '@services/types';
import { BenchmarkResults } from './BenchmarkResults';
import {
  BENCHMARK_PRESETS,
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkRunRequest,
} from './types';
import {
  Zap,
  Play,
  Loader2,
  Gauge,
  Cpu,
  Thermometer,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { toast } from 'sonner';

function ModelSelector({
  models,
  selectedModel,
  onSelect,
}: {
  models: ModelInfo[];
  selectedModel?: string;
  onSelect: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = models.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" data-model-dropdown>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2.5 text-sm text-left transition-colors',
          open ? 'border-ring ring-2 ring-ring/20' : 'hover:bg-accent'
        )}
      >
        <span className="truncate">
          {selectedModel
            ? models.find(m => m.id === selectedModel)?.id || selectedModel
            : 'Select a model...'}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No models found
              </p>
            ) : (
              filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    m.id === selectedModel ? 'bg-accent' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.id}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.path}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.size_human}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  icon: Icon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  icon?: React.ElementType;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function BenchmarkPage() {
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState('');
  const [config, setConfig] = useState<BenchmarkConfig>({
    model: '',
    n_predict: 128,
    threads: 4,
    context_size: 512,
    temperature: 0.7,
  });
  const [isRunning, setIsRunning] = useState(false);

  const { data: models } = useQuery({
    queryKey: ['models'],
    queryFn: apiService.getModels,
    staleTime: 60_000,
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['benchmark-results'],
    queryFn: apiService.getBenchmarkResults,
    staleTime: 10_000,
    refetchInterval: 5_000,
  });

  const runMutation = useMutation({
    mutationFn: (cfg: BenchmarkRunRequest) => apiService.benchmarkRun(cfg),
    onSuccess: () => {
      setIsRunning(true);
      toast.success('Benchmark started');
      // Poll for results
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['benchmark-results'] });
        const latest = queryClient.getQueryData<BenchmarkResult[]>(['benchmark-results']);
        if (latest && latest.some(r => r.status === 'completed')) {
          setIsRunning(false);
          clearInterval(poll);
          toast.success('Benchmark completed');
        }
      }, 3000);
    },
    onError: (err) => {
      toast.error(`Benchmark failed: ${err.message}`);
      setIsRunning(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: apiService.clearBenchmarkResults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benchmark-results'] });
      toast.success('Results cleared');
    },
  });

  const applyPreset = useCallback((preset: typeof BENCHMARK_PRESETS[0]) => {
    setConfig(prev => ({
      ...prev,
      n_predict: preset.config.n_predict,
      threads: preset.config.threads,
      context_size: preset.config.context_size,
      temperature: preset.config.temperature,
    }));
  }, []);

  const handleRun = () => {
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }
    setIsRunning(true);
    runMutation.mutate({
      model: selectedModel,
      n_predict: config.n_predict,
      threads: config.threads,
      context_size: config.context_size,
      temperature: config.temperature,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Benchmark</h1>
        <p className="text-sm text-muted-foreground">
          Compare model performance across different configurations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Configuration</h3>
            </div>

            {/* Model Selector */}
            <ModelSelector
              models={models || []}
              selectedModel={selectedModel}
              onSelect={(id) => {
                setSelectedModel(id);
                setConfig(prev => ({ ...prev, model: id }));
              }}
            />

            {/* Presets */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quick Presets</p>
              <div className="grid grid-cols-3 gap-2">
                {BENCHMARK_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className="rounded-md border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Parameters */}
            <div className="space-y-3">
              <NumberInput
                label="Tokens to Generate"
                value={config.n_predict}
                onChange={(v) => setConfig(prev => ({ ...prev, n_predict: v }))}
                min={16}
                max={8192}
                step={16}
                icon={Zap}
              />
              <NumberInput
                label="Threads"
                value={config.threads}
                onChange={(v) => setConfig(prev => ({ ...prev, threads: v }))}
                min={1}
                max={16}
                icon={Cpu}
              />
              <NumberInput
                label="Context Size"
                value={config.context_size}
                onChange={(v) => setConfig(prev => ({ ...prev, context_size: v }))}
                min={256}
                max={8192}
                step={256}
                icon={Thermometer}
              />
              <NumberInput
                label="Temperature"
                value={config.temperature}
                onChange={(v) => setConfig(prev => ({ ...prev, temperature: v }))}
                min={0}
                max={2}
                step={0.1}
                icon={Gauge}
              />
            </div>

            {/* Run Button */}
            <button
              onClick={handleRun}
              disabled={!selectedModel || isRunning}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors',
                !selectedModel || isRunning
                  ? 'bg-muted/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Benchmark...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Benchmark
                </>
              )}
            </button>
          </div>

          {/* Config Summary */}
          {selectedModel && (
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Active Configuration</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono truncate">{selectedModel}</span>
                <span className="text-muted-foreground">Tokens:</span>
                <span className="font-mono">{config.n_predict}</span>
                <span className="text-muted-foreground">Threads:</span>
                <span className="font-mono">{config.threads}</span>
                <span className="text-muted-foreground">Context:</span>
                <span className="font-mono">{config.context_size}</span>
                <span className="text-muted-foreground">Temp:</span>
                <span className="font-mono">{config.temperature}</span>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          <BenchmarkResults
            results={results || []}
            isLoading={resultsLoading}
            onClear={() => clearMutation.mutate()}
          />
        </div>
      </div>
    </div>
  );
}
