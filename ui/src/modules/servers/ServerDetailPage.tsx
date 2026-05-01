import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerMutation } from '@shared/hooks/useServerMutation';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '@components/common/Badge';
import { apiService } from '@services/apiService';
import {
  Loader2,
  Square,
  RefreshCw,
  ArrowLeft,
  Cpu,
  Clock,
  Server,
  Zap,
  Rocket,
  Key,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { formatBytes, formatNumber, formatUptime } from '@utils/format';
import { statusVariant, statusLabel, RefreshButton } from '@components/servers/SharedServerComponents';

export function ServerDetailPage() {
  const queryClient = useQueryClient();
  const { serverId } = useParams<{ serverId: string }>();
  

  // Always call hooks first — guard via conditional rendering below
  const { data: server, isLoading, error } = useQuery({
    queryKey: ['server', serverId ?? ''],
    queryFn: () => apiService.getServer(serverId!),
    refetchInterval: 5000,
    enabled: !!serverId,
  });

  const { trigger: stopServer, isLoading: isStopping } = useServerMutation({
    mutationFn: () => apiService.stopServer(serverId!),
    queryKeys: [['server', serverId!], ['servers']],
    successMessage: 'Server stopped',
    errorMessage: 'Failed to stop server',
  });

  const { trigger: restartServer, isLoading: isRestarting } = useServerMutation({
    mutationFn: () => apiService.restartServer(serverId!),
    queryKeys: [['server', serverId!], ['servers']],
    successMessage: 'Server restarting',
    errorMessage: 'Failed to restart server',
  });

  // Guard: no serverId in URL
  if (!serverId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-destructive">No server ID provided in URL</p>
          <Link
            to="/servers"
            className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Servers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/servers"
            className="inline-flex items-center gap-1 rounded-md p-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {server?.name || serverId}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{serverId}</span>
              {server?.port != null && (
                <span className="ml-2">· Port {server.port}</span>
              )}
            </p>
          </div>
        </div>
        <RefreshButton onClick={() => queryClient.invalidateQueries({ queryKey: ['server', serverId] })} />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm text-destructive">
            Failed to load server data: {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      )}

      {server && !isLoading && (
        <>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Badge variant={statusVariant(server.status)}>
                  {statusLabel(server.status)}
                </Badge>
                {server.model && (
                  <span className="text-sm text-muted-foreground">
                    {server.model}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (window.confirm(`Restart ${server.name || serverId}? The server will be temporarily unavailable.`)) {
                      restartServer();
                    }
                  }}
                  disabled={server.status !== 'running' || isRestarting}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent',
                    (server.status !== 'running' || isRestarting) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isRestarting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Restart
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Stop ${server.name || serverId}? This action will terminate the server process.`)) {
                      stopServer();
                    }
                  }}
                  disabled={server.status !== 'running' || isStopping}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10',
                    (server.status !== 'running' || isStopping) && 'opacity-50 cursor-not-allowed'
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

          <div className="grid gap-4 md:grid-cols-2">
            {server.gpuInfo && (
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Cpu className="h-4 w-4" />
                    GPU
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-medium">{server.gpuInfo.model || '—'}</span>
                  </div>
                  {server.gpuInfo.index != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Index</span>
                      <span>{server.gpuInfo.index}</span>
                    </div>
                  )}
                  {server.gpuInfo.memoryUsed != null && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Memory Used</span>
                        <span>{formatBytes(server.gpuInfo.memoryUsed)}</span>
                      </div>
                      {server.gpuInfo.memoryTotal != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Memory Total</span>
                          <span>{formatBytes(server.gpuInfo.memoryTotal)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {server.gpuInfo.utilization != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span>{formatNumber(server.gpuInfo.utilization)}%</span>
                    </div>
                  )}
                  {server.gpuInfo.temperature != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Temperature</span>
                      <span>{server.gpuInfo.temperature}°C</span>
                    </div>
                  )}
                  {server.gpuInfo.powerUsage != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Power</span>
                      <span>{server.gpuInfo.powerUsage}W{server.gpuInfo.powerLimit != null && ` / ${server.gpuInfo.powerLimit}W`}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {server.tokenUsage && (server.tokenUsage.totalTokens ?? 0) > 0 && (
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Zap className="h-4 w-4" />
                    Token Usage
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prompt Tokens</span>
                    <span>{formatNumber(server.tokenUsage.promptTokens, 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Completion Tokens</span>
                    <span>{formatNumber(server.tokenUsage.completionTokens, 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Tokens</span>
                    <span className="font-medium">{formatNumber(server.tokenUsage.totalTokens, 0)}</span>
                  </div>
                  {server.tokenUsage.timePerToken != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time / Token</span>
                      <span>{(server.tokenUsage.timePerToken * 1000).toFixed(1)}ms</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {server.uptimeSeconds != null && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b bg-muted/30 px-4 py-3">
                <h3 className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4" />
                  Session Info
                </h3>
              </div>
              <div className="p-4 grid gap-3 sm:grid-cols-3">
                {server.uptimeSeconds != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-medium">{formatUptime(server.uptimeSeconds)}</span>
                  </div>
                )}
                {server.model && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Model</span>
                    <span className="truncate font-mono">{server.model}</span>
                  </div>
                )}
                {server.port != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Port</span>
                    <span>{server.port}</span>
                  </div>
                )}
              </div>
            </div>
          )}

         {server.launchConfig && Object.keys(server.launchConfig).length > 0 && (
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Server className="h-4 w-4" />
                    Launch Configuration
                  </h3>
                  <Link
                    to={`/launch?${new URLSearchParams({
                      model: String(server.model || ''),
                      port: server.port != null ? String(server.port) : '',
                    }).toString()}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    Launch
                  </Link>
                </div>
                <div className="p-4 space-y-2">
                  {Object.entries(server.launchConfig).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Key className="h-3.5 w-3.5" />
                        {key}
                      </span>
                      <span className="font-mono text-foreground">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </>
      )}

      {/* Empty State */}
      {!server && !isLoading && !error && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <Clock className="mx-auto mb-3 h-8 w-8" />
          <p>Server not found</p>
          <Link
            to="/servers"
            className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Servers
          </Link>
        </div>
      )}
    </div>
  );
}
