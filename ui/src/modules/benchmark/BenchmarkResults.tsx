import { useState, useMemo } from 'react';
import { Download, ArrowUpDown, Loader2, Trash2 } from 'lucide-react';
import type { BenchmarkResult } from './types';
import type { FullBenchmarkReport } from '@services/apiService';

interface BenchmarkResultsProps {
  results: BenchmarkResult[];
  isLoading: boolean;
  onClear?: () => void;
}

type SortField = 'modelName' | 'tokensPerSec' | 'timePerToken' | 'memoryUsed';
type SortDir = 'asc' | 'desc';
type ViewMode = 'old' | 'multi';

export function BenchmarkResults({ results, isLoading, onClear }: BenchmarkResultsProps) {
  const [sortField, setSortField] = useState<SortField>('tokensPerSec');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('old');

  const oldResults = results.filter(r => 'tokensPerSec' in r && !('benchmarks' in r)) as BenchmarkResult[];
  const multiResults = results.filter(r => 'benchmarks' in r && typeof r.benchmarks === 'object') as unknown as FullBenchmarkReport[];

  // ── Old-style throughput table ──────────────────────────────────
  const sortedOldResults = useMemo(() => {
    if (oldResults.length === 0) return [];
    const completed = oldResults.filter(r => r.status === 'completed').sort((a, b) => a.tokensPerSec - b.tokensPerSec);
    const pending = oldResults.filter(r => r.status !== 'completed');
    return [...pending, ...completed];
  }, [oldResults]);

  const maxTokensPerSec = useMemo(() => {
    const completed = oldResults.filter(r => r.status === 'completed');
    if (completed.length === 0) return 1;
    return Math.max(...completed.map(r => r.tokensPerSec), 1);
  }, [oldResults]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const exportResults = () => {
    const data = JSON.stringify(results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Multi-benchmark table ───────────────────────────────────────
  const multiBenchmarkKeys = useMemo(() => {
    if (multiResults.length === 0) return [];
    const keys = new Set<string>();
    multiResults.forEach(r => Object.keys(r.benchmarks).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [multiResults]);

  const bestScores = useMemo(() => {
    const scores: Record<string, number> = {};
    multiBenchmarkKeys.forEach(key => {
      if (key === 'throughput') scores[key] = Math.max(...multiResults.map(r => r.benchmarks[key]?.score ?? 0));
      else if (key === 'perplexity') scores[key] = Math.min(...multiResults.map(r => r.benchmarks[key]?.score ?? Infinity));
      else scores[key] = Math.max(...multiResults.map(r => r.benchmarks[key]?.score ?? 0));
    });
    return scores;
  }, [multiResults, multiBenchmarkKeys]);

  // ── Render ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading results...
      </div>
    );
  }

  const totalResults = oldResults.length + multiResults.length;
  if (totalResults === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No benchmark results yet. Run a benchmark to see comparison data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {oldResults.filter(r => r.status === 'completed').length} throughput runs, {multiResults.length} multi-benchmark reports
          </p>
          {multiResults.length > 0 && (
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setViewMode('old')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === 'old' ? 'bg-accent' : 'hover:bg-muted/50'}`}
              >
                Throughput
              </button>
              <button
                onClick={() => setViewMode('multi')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === 'multi' ? 'bg-accent' : 'hover:bg-muted/50'}`}
              >
                Multi-Benchmark
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {onClear && totalResults > 0 && (
            <button onClick={onClear} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          {totalResults > 0 && (
            <button onClick={exportResults} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
          )}
        </div>
      </div>

      {/* Old-style throughput table */}
      {viewMode === 'old' && oldResults.length > 0 && (
        <OldStyleTable
          results={sortedOldResults}
          maxTokensPerSec={maxTokensPerSec}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {/* Multi-benchmark table */}
      {viewMode === 'multi' && multiResults.length > 0 && (
        <MultiBenchmarkTable
          results={multiResults}
          benchmarkKeys={multiBenchmarkKeys}
          bestScores={bestScores}
        />
      )}

      {/* Error messages */}
      {oldResults.some(r => r.status === 'failed' && r.errorMessage) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-medium text-destructive mb-2">Failed runs:</p>
          {oldResults.filter(r => r.status === 'failed').map(r => (
            <p key={r.id} className="text-xs text-muted-foreground font-mono">{r.modelName}: {r.errorMessage}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Old-style throughput-only table ────────────────────────────────

function OldStyleTable({
  results, maxTokensPerSec, sortField, sortDir, onSort,
}: {
  results: BenchmarkResult[]; maxTokensPerSec: number;
  sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Model</th>
            <th className="cursor-pointer select-none text-right px-4 py-3 font-medium text-muted-foreground hover:text-foreground" onClick={() => onSort('tokensPerSec')}>
              <span className="inline-flex items-center gap-1">Tokens/sec {sortField === 'tokensPerSec' && <ArrowUpDown className={`h-3 w-3 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />}</span>
            </th>
            <th className="cursor-pointer select-none text-right px-4 py-3 font-medium text-muted-foreground hover:text-foreground" onClick={() => onSort('timePerToken')}>
              <span className="inline-flex items-center gap-1">Time/tok (ms) {sortField === 'timePerToken' && <ArrowUpDown className={`h-3 w-3 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />}</span>
            </th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Memory</th>
            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Performance</th>
            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map(result => (
            <tr key={result.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={result.modelName}>{result.modelName}</td>
              <td className="px-4 py-3 text-right font-mono">{result.status === 'completed' ? result.tokensPerSec.toFixed(1) : '-'}</td>
              <td className="px-4 py-3 text-right font-mono">{result.status === 'completed' ? (result.timePerToken * 1000).toFixed(1) : '-'}</td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{result.memoryUsed ? `${(result.memoryUsed / 1_073_741_824).toFixed(1)} GB` : '-'}</td>
              <td className="px-4 py-3">
                {result.status === 'completed' && result.tokensPerSec > 0 ? (
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/30 sm:w-32">
                      <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${Math.min((result.tokensPerSec / maxTokensPerSec) * 100, 100)}%` }} />
                    </div>
                  </div>
                ) : <span className="text-muted-foreground">-</span>}
              </td>
              <td className="px-4 py-3 text-center">
                {result.status === 'completed' && <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">Done</span>}
                {result.status === 'running' && <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-500"><Loader2 className="h-3 w-3 animate-spin" /> Running</span>}
                {result.status === 'failed' && <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Failed</span>}
                {result.status === 'pending' && <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Pending</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Multi-benchmark comparison table ───────────────────────────────

function MultiBenchmarkTable({
  results, benchmarkKeys, bestScores,
}: {
  results: FullBenchmarkReport[]; benchmarkKeys: string[]; bestScores: Record<string, number>;
}) {
  const benchmarkLabels: Record<string, string> = {
    throughput: 'Throughput (tok/s)',
    perplexity: 'Perplexity',
    mmlu: 'MMLU (%)',
    gsm8k: 'GSM8K (%)',
    hellaswag: 'HellaSwag (%)',
    aime: 'AIME (%)',
  };

  const formatValue = (key: string, score: number): string => {
    if (key === 'throughput') return score.toFixed(1);
    if (key === 'perplexity') return score.toFixed(2);
    return score.toFixed(1) + '%';
  };

  const isBest = (key: string, score: number): boolean => {
    if (key === 'throughput' || key === 'mmlu' || key === 'gsm8k' || key === 'hellaswag' || key === 'aime') {
      return Math.abs(score - bestScores[key]) < 0.01;
    }
    // For perplexity, lower is better
    if (key === 'perplexity') {
      return Math.abs(score - bestScores[key]) < 0.01;
    }
    return false;
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-card z-10">Model</th>
            {benchmarkKeys.map(key => (
              <th key={key} className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                {benchmarkLabels[key] || key}
              </th>
            ))}
            <th className="text-center px-4 py-3 font-medium text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody>
          {results.map((report, idx) => (
            <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium max-w-[200px] truncate sticky left-0 bg-card z-10" title={report.model_path}>
                {report.model_path.split('/').pop() || report.model_path}
              </td>
              {benchmarkKeys.map(key => {
                const agg = report.benchmarks[key];
                if (!agg) return <td key={key} className="px-4 py-3 text-right font-mono text-muted-foreground">-</td>;
                const best = isBest(key, agg.score);
                return (
                  <td key={key} className={`px-4 py-3 text-right font-mono ${best ? 'font-bold text-emerald-500' : ''}`} title={`${agg.unit}${agg.tasks_run ? ` (${agg.tasks_run} tasks)` : ''}`}>
                    {formatValue(key, agg.score)}
                    {best && <span className="ml-1 text-xs">★</span>}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-center text-xs text-muted-foreground">{report.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
