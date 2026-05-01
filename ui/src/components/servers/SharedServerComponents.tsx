import { useState, useEffect } from 'react';
import { Loader2, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import { Badge } from '@components/common/Badge';
import type { ServerInfo } from '@services/types';
import { formatUptime } from '@utils/format';

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

export function ServerRow({
  server,
  onOpen,
}: {
  server: ServerInfo;
  onOpen: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [isStopping, setIsStopping] = useState(false);

  const stopMutation = useMutation({
    mutationFn: () => apiService.stopServer(server.id),
    onMutate: () => setIsStopping(true),
    onSuccess: () => {
      toast.success('Server stopped');
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
    onError: () => toast.error('Failed to stop server'),
    onSettled: () => setIsStopping(false),
  });

  return (
    <tr className="border-b last:border-b-0 hover:bg-accent/50">
      <td className="px-4 py-3">
        <button
          onClick={() => onOpen(server.id)}
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
            onClick={() => onOpen(server.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Stop ${server.name || server.id}? This action will terminate the server process.`)) {
                stopMutation.mutate();
              }
            }}
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
