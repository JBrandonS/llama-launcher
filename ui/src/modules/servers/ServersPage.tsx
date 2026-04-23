import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@components/common/Badge';
import { apiService } from '@services/apiService';
import { Loader2, Plus, RefreshCw, ArrowUpDown, Search, Eye } from 'lucide-react';
import { cn } from '@utils/cn';
import type { ServerInfo } from '@services/types';

type SortField = 'id' | 'name' | 'status' | 'gpu' | 'uptime';
type SortDir = 'asc' | 'desc';

function StatusBadge({ status }: { status: string }) {
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

function ServerRow({
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
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
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
            onClick={() => stopMutation.mutate()}
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

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ServersPage() {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: () => apiService.getServers(),
    refetchInterval: 5000,
  });

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
    },
    [sortField]
  );

  const filtered = servers
    .filter((s) =>
      search
        ? s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.id.includes(search)
        : true
    )
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'id':
          cmp = a.id.localeCompare(b.id);
          break;
        case 'name':
          cmp = (a.name ?? '').localeCompare(b.name ?? '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'gpu':
          cmp = (a.gpuInfo?.memoryUsed ?? 0) - (b.gpuInfo?.memoryUsed ?? 0);
          break;
        case 'uptime':
          cmp = (a.uptimeSeconds ?? 0) - (b.uptimeSeconds ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filtered.length / limit);
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-sm text-muted-foreground">
            Manage inference servers ({filtered.length} total)
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" />
          New Server
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <button
          onClick={() => {
            setPage(1);
          }}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              {(
                [
                  ['id', 'Name'],
                  ['status', 'Status'],
                  ['name', 'Port'],
                  ['gpu', 'Model'],
                  ['uptime', 'GPU'],
                ] as [SortField, string][]
              ).map(([field, label]) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="cursor-pointer px-4 py-2.5 text-left font-medium hover:bg-accent/50"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortField === field && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No servers found
                </td>
              </tr>
            ) : (
              paged.map((server) => (
                <ServerRow
                  key={server.id}
                  server={server}
                  onOpen={(id) => {
                    window.location.href = `/servers/${id}`;
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, filtered.length)} of{' '}
            {filtered.length}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 w-8 rounded-md text-sm',
                    page === p
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
