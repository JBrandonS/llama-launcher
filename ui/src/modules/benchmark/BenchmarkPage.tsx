import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, type BenchmarkTypeInfo, type SavedBenchmarkSummary } from '@services/apiService';
import { ModelInfo } from '@services/types';
import { BenchmarkResults } from './BenchmarkResults';
import {
  BENCHMARK_PRESETS,
  type BenchmarkConfig,
} from './types';
import {
  Zap, Play, Loader2, Cpu,
  Settings2, ChevronDown, BarChart3,
  CheckCircle2, FolderOpen, Trash2, Download,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { toast } from 'sonner';

// ── Multi-model selector (checkbox list) ───────────────────────────

function ModelMultiSelector({
  models,
  selectedIds,
  onSelect,
}: {
  models: ModelInfo[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = models.filter(m =>
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.path.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onSelect(next);
  };

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
          {selectedIds.length === 0
            ? 'Select models...'
            : `${selectedIds.length} model(s) selected`}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-lg border bg-card shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No models found</p>
          ) : (
            filtered.map(m => (
              <label
                key={m.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer',
                  selectedIds.includes(m.id) ? 'bg-accent' : 'hover:bg-muted/50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.id}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.path}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{m.size_human}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Benchmark type checkbox group ──────────────────────────────────

function BenchmarkTypeSelector({
  types,
  selectedIds,
  onSelect,
}: {
  types: BenchmarkTypeInfo[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onSelect(next);
  };

  if (types.length === 0) {
    return <p className="text-xs text-muted-foreground">No benchmark types available</p>;
  }

  return (
    <div className="space-y-1.5">
      {types.map(t => (
        <label
          key={t.id}
          className={cn(
            'flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer border',
            selectedIds.includes(t.id) ? 'bg-accent border-ring/50' : 'hover:bg-muted/50 border-transparent'
          )}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(t.id)}
            onChange={() => toggle(t.id)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <div>
            <span className="font-medium">{t.label}</span>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Saved results panel ────────────────────────────────────────────

function SavedResultsPanel({
  results,
  isLoading,
  onExport,
  onClear,
  onLoad,
}: {
  results: SavedBenchmarkSummary[];
  isLoading: boolean;
  onExport: () => void;
  onClear: () => void;
  onLoad: (name: string) => void;
}) {
  if (results.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Saved Results ({results.length})
        </h3>
        <div className="flex gap-1.5">
          {results.length > 0 && (
            <>
              <button onClick={onExport} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="Export all">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button onClick={onClear} className="p-1.5 rounded-md hover:bg-accent text-destructive" title="Clear all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
        </div>
      ) : results.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No saved results yet</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {results.map(r => (
            <div
              key={r.name}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => onLoad(r.name)}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.timestamp}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {Object.keys(r.benchmarks).length} benchmarks
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Benchmark Page ────────────────────────────────────────────

export function BenchmarkPage() {
  const queryClient = useQueryClient();
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['throughput']);
  const [config, setConfig] = useState<BenchmarkConfig>({
    model: '', n_predict: 128, threads: 4, context_size: 512, temperature: 0.7,
  });
  const [nTasksPerBenchmark, setNTasksPerBenchmark] = useState(3);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch models, benchmark types, and saved results
  const { data: models } = useQuery({
    queryKey: ['models'],
    queryFn: apiService.getModels,
    staleTime: 60_000,
  });

  const { data: benchmarkTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['benchmark-types'],
    queryFn: apiService.getBenchmarkTypes,
  });

  const { data: savedResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['saved-benchmark-results'],
    queryFn: apiService.getSavedBenchmarkResults,
    staleTime: 10_000,
    refetchInterval: 5_000,
  });

  // Also fetch old-style results for backward compatibility
  const { data: oldResults } = useQuery({
    queryKey: ['benchmark-results'],
    queryFn: apiService.getBenchmarkResults,
    staleTime: 10_000,
  });

  const runMutation = useMutation({
    mutationFn: (cfg: { model_paths: string[]; benchmark_ids: string[]; n_tasks_per_benchmark: number; threads: number }) =>
      apiService.benchmarkMultiRun(cfg),
    onSuccess: () => {
      setIsRunning(true);
      toast.success('Multi-benchmark started');
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['saved-benchmark-results'] });
        const latest = queryClient.getQueryData<SavedBenchmarkSummary[]>(['saved-benchmark-results']);
        // If any new result appeared, stop polling
        if (latest && latest.length > 0) {
          setIsRunning(false);
          clearInterval(poll);
          toast.success('Multi-benchmark completed');
        }
      }, 5000);
    },
    onError: (err) => {
      toast.error(`Benchmark failed: ${err.message}`);
      setIsRunning(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: apiService.clearSavedBenchmarkResults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-benchmark-results'] });
      toast.success('Results cleared');
    },
  });

  const exportAllResults = useCallback(() => {
    if (!savedResults || savedResults.length === 0) return;
    const data = JSON.stringify(savedResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [savedResults]);

  const handleLoadResult = useCallback(async (name: string) => {
    const result = await apiService.getFullBenchmarkResult(name);
    if (result) {
      const modelName = result.model_path.split('/').pop() || result.model_path;
      toast.info('Loaded benchmark report', {
        description: `${Object.keys(result.benchmarks).length} benchmarks on ${modelName}`,
      });
      // Show results in the results panel by adding to oldResults state
      queryClient.setQueryData(['benchmark-results'], (old: any[] = []) => [...old, result]);
    }
  }, [queryClient]);

  const handleRun = () => {
    if (selectedModels.length === 0) {
      toast.error('Please select at least one model');
      return;
    }
    if (selectedBenchmarks.length === 0) {
      toast.error('Please select at least one benchmark type');
      return;
    }
    setIsRunning(true);
    runMutation.mutate({
      model_paths: selectedModels,
      benchmark_ids: selectedBenchmarks,
      n_tasks_per_benchmark: nTasksPerBenchmark,
      threads: config.threads,
    });
  };

  const applyPreset = useCallback((preset: typeof BENCHMARK_PRESETS[0]) => {
    setConfig(prev => ({ ...prev, ...preset.config }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          Benchmark
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare model performance across multiple benchmark types
        </p>
      </div>

      {/* Main layout: Config | Progress | Results */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── Left Panel: Configuration ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Model selection */}
          <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Configuration</h3>
            </div>

            <ModelMultiSelector
              models={models || []}
              selectedIds={selectedModels}
              onSelect={setSelectedModels}
            />

            {/* Benchmark type selection */}
            {typesLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading benchmarks...
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Benchmark Types</p>
                <BenchmarkTypeSelector
                  types={benchmarkTypes || []}
                  selectedIds={selectedBenchmarks}
                  onSelect={setSelectedBenchmarks}
                />
              </div>
            )}

            {/* Parameters */}
            <div className="space-y-3">
              <NumberInput
                label="Tasks per Benchmark"
                value={nTasksPerBenchmark}
                onChange={setNTasksPerBenchmark}
                min={1}
                max={10}
                step={1}
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
            </div>

            {/* Presets (for inference params) */}
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

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={selectedModels.length === 0 || selectedBenchmarks.length === 0 || isRunning}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors',
                selectedModels.length === 0 || selectedBenchmarks.length === 0 || isRunning
                  ? 'bg-muted/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Multi-Benchmark
                </>
              )}
            </button>
          </div>

          {/* Active config summary */}
          {selectedModels.length > 0 && (
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Active Configuration</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Models:</span>
                <span className="font-mono truncate">{selectedModels.length}</span>
                <span className="text-muted-foreground">Benchmarks:</span>
                <span className="font-mono">{selectedBenchmarks.length}</span>
                <span className="text-muted-foreground">Tasks each:</span>
                <span className="font-mono">{nTasksPerBenchmark}</span>
                <span className="text-muted-foreground">Threads:</span>
                <span className="font-mono">{config.threads}</span>
              </div>
            </div>
          )}

          {/* Saved results */}
          <SavedResultsPanel
            results={savedResults || []}
            isLoading={resultsLoading}
            onExport={exportAllResults}
            onClear={() => clearMutation.mutate()}
            onLoad={handleLoadResult}
          />
        </div>

        {/* ── Right Panel: Results ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <BenchmarkResults
            results={oldResults || []}
            isLoading={resultsLoading}
            onClear={() => clearMutation.mutate()}
          />
        </div>
      </div>
    </div>
  );
}

// ── Reusable NumberInput (used by both old and new page) ───────────

function NumberInput({
  label, value, onChange, min, max, step = 1, icon: Icon,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; icon?: React.ElementType;
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
        min={min} max={max} step={step}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
