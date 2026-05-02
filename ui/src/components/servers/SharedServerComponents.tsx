import { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@utils/cn';
import { Badge } from '@components/common/Badge';
import type { ServerInfo } from '@services/types';
import { formatUptime } from '@utils/format';
import { useServerStop } from '@shared/hooks/useServerStop';

// ─── Status helpers ───────────────────────────────────────────────
export function statusVariant(status: string): 'success' | 'warning' | 'info' | 'neutral' | 'destructive' {
  switch (status) {
    case 'running': return 'success';
    case 'starting': return 'info';
    case 'stopping': return 'warning';
    case 'stopped': return 'neutral';
    case 'error': return 'destructive';
    default: return 'neutral';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'running': return 'Running';
    case 'starting': return 'Starting';
    case 'stopping': return 'Stopping';
    case 'stopped': return 'Stopped';
    case 'error': return 'Error';
    default: return status;
  }
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === 'running'
          ? 'success'
          : status === 'stopping'
            ? 'warning'
            : status === 'starting'
              ? 'info'
              : 'neutral'
      }
    >
      {status}
    </Badge>
  );
}

export function ServerCard({
  server,
}: {
  server: ServerInfo;
}) {
  const { isLoading: isStopping, onStop } = useServerStop(server);

  return (
    <div
      className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50"
      role="article"
      aria-label={`Server ${server.name || server.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">
              {server.name || server.id}
            </h3>
            <StatusBadge status={server.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{server.id}</span>
            {server.port != null && <span className="ml-1">· Port {server.port}</span>}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {server.model && (
              <>
                <span className="text-muted-foreground">Model:</span>
                <span className="truncate">{server.model}</span>
              </>
            )}
            {server.gpuInfo?.model && (
              <>
                <span className="text-muted-foreground">GPU:</span>
                <span className="truncate">{server.gpuInfo.model}</span>
              </>
            )}
            {server.gpuInfo?.memoryUsed != null && (
              <>
                <span className="text-muted-foreground">VRAM:</span>
                <span>{server.gpuInfo.memoryUsed} / {server.gpuInfo.memoryTotal} MB</span>
              </>
            )}
            {server.uptimeSeconds != null && (
              <>
                <span className="text-muted-foreground">Uptime:</span>
                <span>{formatUptime(server.uptimeSeconds)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={onStop}
            disabled={server.status !== 'running' || isStopping}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md border text-xs transition-colors',
              server.status === 'running'
                ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                : 'cursor-not-allowed border-border/50 opacity-50'
            )}
            aria-label={`Stop ${server.name || server.id}`}
            aria-disabled={server.status !== 'running' || isStopping}
            aria-busy={isStopping}
            title={isStopping ? 'Stopping...' : 'Stop server'}
          >
            {isStopping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="font-medium">Stop</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ServerRow({
  server,
  onOpen,
}: {
  server: ServerInfo;
  onOpen?: (id: string) => void;
}) {
  const { isLoading: isStopping, onStop } = useServerStop(server);

  return (
    <tr className="border-b last:border-b-0 hover:bg-accent/50">
      <td className="px-4 py-3">
        <button
          onClick={() => onOpen?.(server.id)}
          className="text-sm font-medium text-foreground hover:underline"
        >
          {server.name || server.id}
        </button>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={server.status} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {server.port ?? '-'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {server.model ?? '-'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {server.gpuInfo?.model ?? '-'}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
        {server.gpuInfo?.memoryUsed != null
          ? `${server.gpuInfo.memoryUsed} / ${server.gpuInfo.memoryTotal} MB`
          : '-'}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {server.uptimeSeconds
          ? formatUptime(server.uptimeSeconds)
          : '-'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onStop}
            disabled={server.status !== 'running' || isStopping}
            className={cn(
              'inline-flex h-8 items-center rounded-md border px-3 text-sm transition-colors',
              server.status === 'running'
                ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                : 'cursor-not-allowed opacity-50'
            )}
          >
            {isStopping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Stop'
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
    >
      <RefreshCw className="h-4 w-4" />
      Refresh
    </button>
  );
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
