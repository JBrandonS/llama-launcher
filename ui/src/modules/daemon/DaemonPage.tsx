import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@components/common/Badge';
import { apiService } from '@services/apiService';
import {
  Loader2,
  Play,
  Square,
  RefreshCw,
  Settings,
  AlertTriangle,
  Activity,
  Clock,
} from 'lucide-react';
import { cn } from '@utils/cn';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DaemonPage() {
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const { data: daemon, isLoading } = useQuery({
    queryKey: ['daemon'],
    queryFn: () => apiService.getDaemonStatus(),
    refetchInterval: 15000,
  });

  const startMutation = useMutation({
    mutationFn: apiService.startDaemon,
    onMutate: () => setIsStarting(true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daemon'] }),
    onSettled: () => setIsStarting(false),
  });

  const stopMutation = useMutation({
    mutationFn: apiService.stopDaemon,
    onMutate: () => setIsStopping(true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daemon'] }),
    onSettled: () => setIsStopping(false),
  });

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : daemon ? (
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
                  onClick={() => startMutation.mutate()}
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
                  onClick={() => stopMutation.mutate()}
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
                  Configuration
                </h3>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Poll Interval', `${daemon.config.pollIntervalSeconds}s`],
                  ['Auto-Start', daemon.config.autoLaunchOnStart ? 'Enabled' : 'Disabled'],
                  ['Max Attempts', String(daemon.config.maxLaunchAttempts ?? 5)],
                  ['Retry Delay', `${daemon.config.retryDelaySeconds}s`],
                  ['Health Check', `${daemon.config.healthCheckInterval}s`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
