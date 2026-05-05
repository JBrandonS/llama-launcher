import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FolderOpen, Play, Loader2, Server, AlertCircle, Check } from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';

interface IniConfig {
  name: string;
  model: string;
  port: number;
  context_size?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  threads?: number;
  n_predict?: number;
  gpu_layers?: number;
}

export function LoadPage() {
  const [dir, setDir] = useState('~/llama/servers/');
  const [selectedPorts, setSelectedPorts] = useState<Set<number>>(new Set());
  const [launchingPorts, setLaunchingPorts] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ini-servers', dir],
    queryFn: () => apiService.getIniServers(dir),
    enabled: false,
  });

  const launchMutation = useMutation({
    mutationFn: (configPath: string) => apiService.iniLaunch(configPath),
    onSuccess: () => {
      toast.success('Server launched successfully');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to launch server');
    },
  });

  const handleLoad = async () => {
    try {
      await refetch();
      if (data?.configs && data.configs.length > 0) {
        toast.success(`Loaded ${data.configs.length} config(s)`);
      } else {
        toast.info('No configs found in directory');
      }
    } catch {
      toast.error('Failed to load configs');
    }
  };

  const handleSelectAll = () => {
    if (!data?.configs) return;
    const allSelected = data.configs.every((c: IniConfig) => selectedPorts.has(c.port));
    if (allSelected) {
      setSelectedPorts(new Set());
    } else {
      setSelectedPorts(new Set(data.configs.map((c: IniConfig) => c.port)));
    }
  };

  const toggleSelect = (port: number) => {
    setSelectedPorts((prev) => {
      const next = new Set(prev);
      if (next.has(port)) {
        next.delete(port);
      } else {
        next.add(port);
      }
      return next;
    });
  };

  const handleLaunchSelected = async () => {
    if (!data?.configs || selectedPorts.size === 0) {
      toast.warning('No configs selected');
      return;
    }

    const configsToLaunch = data.configs.filter((c: IniConfig) => selectedPorts.has(c.port));
    setLaunchingPorts(new Set(selectedPorts));

    for (const config of configsToLaunch) {
      const configPath = `${dir}/${config.name}.ini`;
      await launchMutation.mutateAsync(configPath);
      setLaunchingPorts((prev) => {
        const next = new Set(prev);
        next.delete(config.port);
        return next;
      });
    }

    setSelectedPorts(new Set());
  };

  const configCount = data?.configs?.length ?? 0;
  const selectedCount = selectedPorts.size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Load Servers</h1>
        <p className="text-sm text-muted-foreground">
          Load server configurations from INI files and launch them
        </p>
      </div>

      {/* Directory Input */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <FolderOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            placeholder="~/llama/servers/"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleLoad}
            disabled={isLoading || launchingPorts.size > 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            Load
          </button>
        </div>
      </div>

      {/* Configs List */}
      {data?.configs && data.configs.length > 0 ? (
        <div className="space-y-4">
          {/* Header with select all */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              {configCount} config{configCount !== 1 ? 's' : ''} loaded
              {selectedCount > 0 && (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {selectedCount} selected
                </span>
              )}
            </div>
            <button
              onClick={handleSelectAll}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {data.configs.every((c: IniConfig) => selectedPorts.has(c.port))
                ? 'Deselect All'
                : 'Select All'}
            </button>
          </div>

          {/* Config cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.configs.map((config: IniConfig) => (
              <div
                key={config.port}
                className={cn(
                  'rounded-lg border p-4 shadow-sm transition-all',
                  selectedPorts.has(config.port)
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/20'
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPorts.has(config.port)}
                    onChange={() => toggleSelect(config.port)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{config.name}</h3>
                      {launchingPorts.has(config.port) && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {!launchingPorts.has(config.port) && selectedPorts.has(config.port) && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{config.model}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">Port: {config.port}</span>
                      {config.context_size && (
                        <span className="rounded bg-muted px-1.5 py-0.5">ctx: {config.context_size}</span>
                      )}
                      {config.threads && (
                        <span className="rounded bg-muted px-1.5 py-0.5">threads: {config.threads}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Launch button */}
          <div className="flex justify-end">
            <button
              onClick={handleLaunchSelected}
              disabled={selectedCount === 0 || launchingPorts.size > 0 || launchMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {launchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Launch Selected ({selectedCount})
            </button>
          </div>
        </div>
      ) : data?.configs && data.configs.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No INI files found in directory</p>
        </div>
      ) : null}
    </div>
  );
}
