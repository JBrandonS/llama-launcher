import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLogSubscription } from '@shared/hooks/useLogSubscription';
import { toast } from 'sonner';
import { Badge } from '@components/common/Badge';
import { apiService } from '@services/apiService';
import { useServerMutation } from '@shared/hooks/useServerMutation';
import type { LogEntry } from '@services/types';
import { Copy } from 'lucide-react';
import {
  Loader2,
  Play,
  Square,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { formatTimestamp, escapeHtml, formatUptime } from '@utils/format';
import { LEVEL_CONFIG, LogLevel, filterBySearch } from '@shared/log/LogUtils';

export function DaemonPage() {
  const queryClient = useQueryClient();
 
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [daemonFollowMode, setDaemonFollowMode] = useState(false);
  const [daemonVisibleCount, setDaemonVisibleCount] = useState(100);
  const [daemonSearch, setDaemonSearch] = useState('');

  const logContainerRef = useRef<HTMLDivElement>(null);

  const { data: daemon, isLoading } = useQuery({
    queryKey: ['daemon'],
    queryFn: () => apiService.getDaemonStatus(),
    refetchInterval: 15000,
  });

  const { trigger: startDaemon, isLoading: isStarting } = useServerMutation({
    mutationFn: apiService.startDaemon,
    queryKeys: [['daemon']],
    successMessage: 'Daemon started',
    errorMessage: 'Failed to start daemon',
  });

  const { trigger: stopDaemon, isLoading: isStopping } = useServerMutation({
    mutationFn: apiService.stopDaemon,
    queryKeys: [['daemon']],
    successMessage: 'Daemon stopped',
    errorMessage: 'Failed to stop daemon',
  });

  const configMutation = useMutation({
    mutationFn: apiService.updateDaemonConfig,
    onSuccess: () => {
      toast.success('Settings updated');
      queryClient.invalidateQueries({ queryKey: ['daemon'] });
    },
    onError: () => toast.error('Failed to update settings'),
  });

  const { data: daemonLogsData, isLoading: logsLoading } = useQuery({
    queryKey: ['daemon-logs', daemonVisibleCount],
    queryFn: () => apiService.getDaemonLogs(daemonVisibleCount),
    refetchInterval: daemonFollowMode ? 2000 : undefined,
    enabled: showLogViewer,
  });

  const [showServiceFile, setShowServiceFile] = useState(false);
  const { data: serviceFileData, isLoading: serviceLoading } = useQuery({
    queryKey: ['daemon-service-file'],
    queryFn: () => apiService.getDaemonServiceFile(),
    enabled: daemon?.status === 'running',
    staleTime: 30_000,
  });

  const daemonLogEntries: LogEntry[] = (daemonLogsData?.entries ?? []).map((e) =>
    e.component === undefined ? { ...e, component: 'daemon' } : e
  );

  useLogSubscription({
    serverId: '__daemon__',
    enabled: daemonFollowMode && showLogViewer,
    cacheKey: ['daemon-logs-incoming'],
  });

  const allDaemonLogEntries: LogEntry[] = [
    ...daemonLogEntries,
    ...(daemonFollowMode
      ? (queryClient.getQueryData(['daemon-logs-incoming']) as LogEntry[] | undefined) ?? []
      : []),
  ];

  const filteredDaemonLogs = allDaemonLogEntries.filter((entry) =>
    filterBySearch(entry, daemonSearch)
  );

  useEffect(() => {
    if (daemonFollowMode && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [daemonLogEntries.length, daemonFollowMode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto-Launch Daemon</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and control the background daemon
          </p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['daemon'] })}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {daemon != null ? (
        <>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Badge
                  variant={
                    daemon.status === 'running'
                      ? 'success'
                      : daemon.status === 'error'
                        ? 'destructive'
                        : 'neutral'
                  }
                >
                  {daemon.status}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {daemon.pid != null && (
                    <span className="font-mono">PID: {daemon.pid}</span>
                  )}
                  {daemon.uptimeSeconds != null && (
                    <span className="ml-4">
                      Uptime: {formatUptime(daemon.uptimeSeconds)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startDaemon()}
                  disabled={daemon.status === 'running' || isStarting}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90',
                    (daemon.status === 'running' || isStarting) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isStarting ? 'Starting...' : 'Start'}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Stop the auto-launch daemon? Server launches will no longer be managed automatically.')) {
                      stopDaemon();
                    }
                  }}
                  disabled={daemon.status !== 'running' || isStopping}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/10',
                    (daemon.status !== 'running' || isStopping) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Stop
                </button>
              </div>
            </div>
          </div>

          {daemon.monitoredServers && daemon.monitoredServers.length > 0 && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b bg-muted/30 px-4 py-3">
                <h3 className="flex items-center gap-2 font-medium">
                  <Activity className="h-4 w-4" />
                  Monitored Servers ({daemon.monitoredServers.length})
                </h3>
              </div>
              <div className="divide-y">
                {daemon.monitoredServers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          s.status === 'running'
                            ? 'success'
                            : s.status === 'error'
                              ? 'destructive'
                              : 'neutral'
                        }
                      >
                        {s.status}
                      </Badge>
                      <span className="text-sm">
                        {s.name || s.id}
                      </span>
                      {s.autoLaunch && (
                        <span className="text-xs text-muted-foreground">auto-launch</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {s.launchCount != null && (
                        <span>Launches: {s.launchCount}</span>
                      )}
                      {s.lastLaunchFailure && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {new Date(s.lastLaunchFailure).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {daemon.errors && daemon.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Recent Errors
              </h3>
              <ul className="space-y-1">
                {daemon.errors.map((err, i) => (
                  <li key={i} className="text-sm text-destructive/80">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {daemon.config && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b bg-muted/30 px-4 py-3">
                <h3 className="flex items-center gap-2 font-medium">
                  <Settings className="h-4 w-4" />
                  Auto-Launch Policy
                </h3>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-muted-foreground">Auto-Start on Daemon Launch</span>
                  <button
                    type="button"
                    onClick={() => {
                      configMutation.mutate({
                        autoLaunchOnStart: !daemon.config!.autoLaunchOnStart,
                      });
                    }}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      daemon.config!.autoLaunchOnStart ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-background transition-transform',
                        daemon.config!.autoLaunchOnStart && 'translate-x-6'
                      )}
                    />
                  </button>
                </label>

                <div className="flex flex-col gap-2">
                  <label htmlFor="pollInterval" className="text-sm text-muted-foreground">Poll Interval (seconds)</label>
                  <input
                    id="pollInterval"
                    type="number"
                    min={1}
                    max={120}
                    defaultValue={daemon.config!.pollIntervalSeconds ?? 10}
                    onBlur={(e) =>
                      configMutation.mutate({ pollIntervalSeconds: Math.max(1, Math.min(120, Number(e.target.value))) })
                    }
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="maxAttempts" className="text-sm text-muted-foreground">Max Launch Attempts</label>
                  <input
                    id="maxAttempts"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={daemon.config!.maxLaunchAttempts ?? 5}
                    onBlur={(e) =>
                      configMutation.mutate({ maxLaunchAttempts: Math.max(1, Math.min(20, Number(e.target.value))) })
                    }
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="retryDelay" className="text-sm text-muted-foreground">Retry Delay (seconds)</label>
                  <input
                    id="retryDelay"
                    type="number"
                    min={1}
                    max={60}
                    defaultValue={daemon.config!.retryDelaySeconds ?? 5}
                    onBlur={(e) =>
                      configMutation.mutate({ retryDelaySeconds: Math.max(1, Math.min(60, Number(e.target.value))) })
                    }
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="healthCheck" className="text-sm text-muted-foreground">Health Check (seconds)</label>
                  <input
                    id="healthCheck"
                    type="number"
                    min={1}
                    max={30}
                    defaultValue={daemon.config!.healthCheckInterval ?? 5}
                    onBlur={(e) =>
                      configMutation.mutate({ healthCheckInterval: Math.max(1, Math.min(30, Number(e.target.value))) })
                    }
                    className="h-9 w-full rounded-md border bg-background px-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          )}

          {daemon?.status === 'running' && (
            <div className="rounded-lg border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setShowServiceFile((v) => !v)}
                className="flex w-full items-center justify-between border-b bg-muted/30 px-4 py-3 text-left"
              >
                <h3 className="flex items-center gap-2 font-medium">
                  <Terminal className="h-4 w-4" />
                  Service File
                </h3>
                {showServiceFile ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showServiceFile && (
                <div className="p-4">
                  {serviceLoading ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : serviceFileData?.content ? (
                    <div className="relative">
                      <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
                        {serviceFileData.content}
                      </pre>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(serviceFileData.content);
                          toast.success('Copied to clipboard');
                        }}
                        className="absolute right-2 top-2 rounded-md border bg-background/80 p-1.5 text-muted-foreground hover:bg-background"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">No service file available</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setShowLogViewer((v) => !v)}
              className="flex w-full items-center justify-between border-b bg-muted/30 px-4 py-3 text-left"
            >
              <h3 className="flex items-center gap-2 font-medium">
                <Terminal className="h-4 w-4" />
                Daemon Logs
                {daemonLogsData?.entries && daemonLogsData.entries.length > 0 && (
                  <Badge variant="neutral" className="ml-2">{daemonLogsData.entries.length}</Badge>
                )}
              </h3>
              {showLogViewer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showLogViewer && (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDaemonFollowMode((v) => !v);
                      setDaemonVisibleCount(100);
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                      daemonFollowMode
                        ? 'bg-primary text-primary-foreground'
                        : 'border bg-background hover:bg-accent'
                    )}
                  >
                    {daemonFollowMode ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {daemonFollowMode ? 'Tail ON' : 'Tail OFF'}
                  </button>
                  <input
                    type="text"
                    placeholder="Search logs…"
                    value={daemonSearch}
                    onChange={(e) => setDaemonSearch(e.target.value)}
                    className="h-8 flex-1 min-w-32 rounded-md border bg-background px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setDaemonVisibleCount((c) => c + 100)}
                    className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
                  >
                    Load More
                  </button>
                  <button
                    type="button"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['daemon-logs'] })}
                    className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
                  >
                    Refresh
                  </button>
                </div>

                {logsLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading logs…
                  </div>
                ) : filteredDaemonLogs.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4" />
                    No logs to display
                  </div>
                ) : (
                  <div
                    ref={logContainerRef}
                    className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 font-mono text-xs"
                  >
                    {filteredDaemonLogs.map((entry, i) => {
                      const lc = LEVEL_CONFIG[entry.level as LogLevel];
                      const Icon = lc.icon;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex items-start gap-2 border-b border-muted/50 px-3 py-1.5 last:border-b-0',
                            entry.level === 'ERROR' || entry.level === 'CRITICAL' ? 'bg-destructive/5' : ''
                          )}
                        >
                          <Icon className={cn('mt-0.5 h-3 w-3 flex-shrink-0', lc.color)} />
                          <span className="text-muted-foreground flex-shrink-0">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                          <span className="flex-shrink-0 font-semibold text-muted-foreground">
                            [{entry.component ?? 'daemon'}]
                          </span>
                          <span
                            className={cn('flex-1 break-all', lc.color)}
                            dangerouslySetInnerHTML={{
                              __html: daemonSearch
                                ? escapeHtml(entry.message).replace(
                                    new RegExp(
                                      `(${daemonSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                                      'gi'
                                    ),
                                    '<mark class="bg-amber-200/30 text-inherit px-0.5 rounded">$1</mark>'
                                  )
                                : escapeHtml(entry.message),
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <Clock className="mx-auto mb-3 h-8 w-8" />
          <p>No daemon status available</p>
        </div>
      )}
    </div>
  );
}
