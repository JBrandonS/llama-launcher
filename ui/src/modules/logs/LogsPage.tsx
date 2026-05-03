import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiService } from '@services/apiService';
import { Badge } from '@components/common/Badge';
import type { LogEntry } from '@services/types';
import {
  Loader2,
  Terminal,
  Search,
  Download,
  Copy,
  RefreshCw,
  ChevronUp,
  Filter,
  Clock,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { formatTimestamp, escapeHtml } from '@utils/format';
import { LEVEL_CONFIG, LogLevel, filterBySearch } from '@shared/log/LogUtils';

export function LogsPage() {
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [followMode, setFollowMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('ALL');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(200);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch server list for server filter
  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiService.getServers(),
    staleTime: 30_000,
  });

  // Fetch daemon logs
  const {
    data: daemonLogsData,
    isLoading: daemonLogsLoading,
    refetch: refetchDaemonLogs,
  } = useQuery({
    queryKey: ['daemon-logs', visibleCount],
    queryFn: () => apiService.getDaemonLogs(visibleCount),
    refetchInterval: followMode ? 2000 : undefined,
  });

  // Fetch server logs (for selected server)
  const {
    data: serverLogsData,
    isLoading: serverLogsLoading,
    refetch: refetchServerLogs,
  } = useQuery({
    queryKey: ['server-logs', selectedServerId, visibleCount],
    queryFn: () => apiService.getLogs(selectedServerId!, undefined, visibleCount),
    enabled: !!selectedServerId && !followMode,
    refetchInterval: followMode ? 2000 : undefined,
  });

  // Combine daemon and server logs
  const daemonEntries: LogEntry[] = (daemonLogsData?.entries ?? []).map((e: LogEntry) =>
    e.component === undefined ? { ...e, component: 'daemon' } : e
  );

  const serverEntries: LogEntry[] = (serverLogsData?.entries ?? []).map((e: LogEntry) =>
    e.component === undefined ? { ...e, component: selectedServerId! } : e
  );

  // Choose which logs to display
  const allEntries: LogEntry[] = selectedServerId ? serverEntries : daemonEntries;

  // Filter by level and search
  const filteredLogs = allEntries.filter((entry) => {
    if (selectedLevel !== 'ALL' && entry.level !== selectedLevel) return false;
    if (searchQuery && !filterBySearch(entry, searchQuery)) return false;
    return true;
  });

  // Auto-scroll in follow mode
  useEffect(() => {
    if (followMode && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [allEntries.length, followMode]);

  const handleCopyLogs = () => {
    const text = filteredLogs.map((e) => `${formatTimestamp(e.timestamp)} [${e.level}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs copied to clipboard');
  };

  const handleDownloadLogs = () => {
    const text = filteredLogs.map((e) => `${formatTimestamp(e.timestamp)} [${e.level}] ${e.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
  };

  const isLoading = daemonLogsLoading || (selectedServerId ? serverLogsLoading : false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-sm text-muted-foreground">
            View and search logs from servers and daemon
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (selectedServerId) refetchServerLogs();
              else refetchDaemonLogs();
            }}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleCopyLogs}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>
          <button
            onClick={handleDownloadLogs}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Server selector */}
          <select
            value={selectedServerId ?? ''}
            onChange={(e) => {
              setSelectedServerId(e.target.value || null);
              setVisibleCount(200);
            }}
            className="h-9 rounded-md border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All (Daemon)</option>
            {servers?.map((s) => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>

          {/* Level filter */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
              showFilters ? 'bg-primary text-primary-foreground' : 'border bg-background hover:bg-accent'
            )}
          >
            <Filter className="h-3 w-3" />
            Filters
          </button>

          {showFilters && (
            <>
              {(['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as LogLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                    selectedLevel === level
                      ? 'bg-primary text-primary-foreground'
                      : 'border bg-background hover:bg-accent'
                  )}
                >
                  {level !== 'ALL' && (
                    (() => { const C = LEVEL_CONFIG[level as LogLevel].icon; return <C className="h-3 w-3" />; })()
                  )}
                  {level}
                </button>
              ))}
            </>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border bg-background pl-9 pr-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Follow mode */}
          <button
            onClick={() => setFollowMode((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
              followMode
                ? 'bg-primary text-primary-foreground'
                : 'border bg-background hover:bg-accent'
            )}
          >
            {followMode ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {followMode ? 'Tail ON' : 'Tail OFF'}
          </button>

          {/* Load more */}
          <button
            onClick={() => setVisibleCount((c) => c + 200)}
            className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            Load More
          </button>
        </div>
      </div>

      {/* Log Display */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-4 py-3">
          <h3 className="flex items-center gap-2 font-medium">
            <Terminal className="h-4 w-4" />
            Log Entries
            {allEntries.length > 0 && (
              <Badge variant="neutral" className="ml-2">{allEntries.length}</Badge>
            )}
          </h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Clock className="mr-2 h-5 w-5" />
            No logs to display
          </div>
        ) : (
          <div
            ref={logContainerRef}
            className="max-h-[60vh] overflow-y-auto"
          >
            {filteredLogs.map((entry, i) => {
              const lc = LEVEL_CONFIG[entry.level as LogLevel];
              const Icon = lc.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 border-b border-muted/50 px-4 py-1.5 last:border-b-0 hover:bg-muted/20',
                    entry.level === 'ERROR' || entry.level === 'CRITICAL' ? 'bg-destructive/5' : ''
                  )}
                >
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 flex-shrink-0', lc.color)} />
                  <span className="text-muted-foreground flex-shrink-0 font-mono text-xs">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    [{entry.component ?? 'unknown'}]
                  </span>
                  <span className={cn('flex-1 break-all font-mono text-xs', lc.color)}>
                    {escapeHtml(entry.message)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
