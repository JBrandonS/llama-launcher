import { useState, useMemo } from 'react';
import { Download, ArrowUpDown, Loader2, Trash2 } from 'lucide-react';
import type { BenchmarkResult } from './types';

interface BenchmarkResultsProps {
  results: BenchmarkResult[];
  isLoading: boolean;
  onClear?: () => void;
}

type SortField = 'modelName' | 'tokensPerSec' | 'timePerToken' | 'memoryUsed';
type SortDir = 'asc' | 'desc';

export function BenchmarkResults({ results, isLoading, onClear }: BenchmarkResultsProps) {
  const [sortField, setSortField] = useState<SortField>('tokensPerSec');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedResults = useMemo(() => {
    if (results.length === 0) return [];
    const completed = results.filter(r => r.status === 'completed').sort((a, b) => a.tokensPerSec - b.tokensPerSec);
    const pending = results.filter(r => r.status !== 'completed');
    return [...pending, ...completed];
  }, [results]);

  const maxTokensPerSec = useMemo(() => {
    const completed = results.filter(r => r.status === 'completed');
    if (completed.length === 0) return 1;
    return Math.max(...completed.map(r => r.tokensPerSec), 1);
  }, [results]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading results...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">No benchmark results yet. Run a benchmark to see comparison data.</p>
      </div>
    );
  }

  const completedResults = sortedResults.filter(r => r.status === 'completed');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {completedResults.length} completed / {results.length} total runs
        </p>
        <div className="flex gap-2">
          {onClear && results.length > 0 && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          {completedResults.length > 0 && (
            <button
              onClick={exportResults}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Model</th>
              <th
                className="cursor-pointer select-none text-right px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleSort('tokensPerSec')}
              >
                <span className="inline-flex items-center gap-1">
                  Tokens/sec
                  {sortField === 'tokensPerSec' && (
                    <ArrowUpDown className={`h-3 w-3 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
                  )}
                </span>
              </th>
              <th
                className="cursor-pointer select-none text-right px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                onClick={() => handleSort('timePerToken')}
              >
                <span className="inline-flex items-center gap-1">
                  Time/tok (ms)
                  {sortField === 'timePerToken' && (
                    <ArrowUpDown className={`h-3 w-3 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
                  )}
                </span>
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Memory</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Performance</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result) => (
              <tr key={result.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={result.modelName}>
                  {result.modelName}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {result.status === 'completed' ? result.tokensPerSec.toFixed(1) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {result.status === 'completed' ? (result.timePerToken * 1000).toFixed(1) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                  {result.memoryUsed ? `${(result.memoryUsed / 1_073_741_824).toFixed(1)} GB` : '-'}
                </td>
                <td className="px-4 py-3">
                  {result.status === 'completed' && result.tokensPerSec > 0 ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/30 sm:w-32">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${Math.min((result.tokensPerSec / maxTokensPerSec) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {result.status === 'completed' && (
                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
                      Done
                    </span>
                  )}
                  {result.status === 'running' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Running
                    </span>
                  )}
                  {result.status === 'failed' && (
                    <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                      Failed
                    </span>
                  )}
                  {result.status === 'pending' && (
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error messages */}
      {results.some(r => r.status === 'failed' && r.errorMessage) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs font-medium text-destructive mb-2">Failed runs:</p>
          {results.filter(r => r.status === 'failed').map(r => (
            <p key={r.id} className="text-xs text-muted-foreground font-mono">
              {r.modelName}: {r.errorMessage}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
