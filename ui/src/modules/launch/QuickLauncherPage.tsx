import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Upload,
  FileJson,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Zap,
  Server,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { apiService } from '@services/apiService';
import type { ValidationError } from '@services/types';
import type { ServerConfig } from '@services/types';
import { parseConfig, getPreviewArgs } from '@utils/configParser';

const RECENT_CONFIGS_KEY = 'launcher:recent-configs';

function getRecentConfigs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CONFIGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRecentConfig(path: string): void {
  try {
    const recent = getRecentConfigs().filter((p) => p !== path);
    recent.unshift(path);
    if (recent.length > 10) recent.pop();
    localStorage.setItem(RECENT_CONFIGS_KEY, JSON.stringify(recent));
  } catch {
    // localStorage full or unavailable
  }
}

function removeRecentConfig(path: string): void {
  try {
    const recent = getRecentConfigs().filter((p) => p !== path);
    localStorage.setItem(RECENT_CONFIGS_KEY, JSON.stringify(recent));
  } catch {
    // ignore
  }
}

function clearRecentConfigs(): void {
  try {
    localStorage.removeItem(RECENT_CONFIGS_KEY);
  } catch {
    // ignore
  }
}

interface ParsedFile {
  name: string;
  path: string;
  content: string;
}

export function QuickLauncherPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  const recentConfigs = getRecentConfigs();

  // ── File handling ────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      toast.error('Invalid file', { description: 'Please select a JSON config file' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseConfig(content);

      if (result.errors.length > 0) {
        setValidationErrors(result.errors);
        setParsedFile(null);
        toast.error('Invalid config', { description: result.errors[0]?.message || 'Check the config file' });
        return;
      }

      setValidationErrors([]);
      setParsedFile({
        name: file.name,
        path: file.name,
        content,
      });
      saveRecentConfig(file.name);
      toast.success('Config loaded', { description: `${result.config?.model?.split('/').pop() || 'Unknown'} at port ${result.config?.port}` });
    };
    reader.onerror = () => {
      toast.error('Read error', { description: 'Failed to read config file' });
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  // ── Launch mutation ──────────────────────────────────────────
  const launchMutation = useMutation({
    mutationFn: async (config: ServerConfig) =>
      apiService.launchFromConfig(config),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server launched', {
        description: `Server started on port ${data.serverId || 'unknown'}`,
      });
      navigate('/servers');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to launch server';
      toast.error('Launch failed', { description: message });
      setIsLaunching(false);
    },
  });

  const handleLaunch = useCallback(() => {
    if (validationErrors.length > 0 || !parsedFile) return;
    const result = parseConfig(parsedFile.content);
    if (!result.config) return;

    setIsLaunching(true);
    launchMutation.mutate(result.config);
  }, [parsedFile, validationErrors, launchMutation]);

  // ── Recent config handlers ───────────────────────────────────
  const handleRecentClick = useCallback(
    (name: string) => {
      // Can't re-read from localStorage since we only store the filename
      // Show a toast and let user re-upload
      toast.info('Re-upload required', {
        description: `Please re-select "${name}" to reload`,
      });
    },
    []
  );

  const handleRecentRemove = useCallback(
    (e: React.MouseEvent, name: string) => {
      e.stopPropagation();
      removeRecentConfig(name);
      toast.success('Removed from recent');
    },
    []
  );

  const handleClearRecent = useCallback(() => {
    clearRecentConfigs();
    toast.success('Recent configs cleared');
  }, []);

  // ── Config preview ───────────────────────────────────────────
  const config = parsedFile ? parseConfig(parsedFile.content).config : null;
  const previewArgs = config ? getPreviewArgs(config.args) : {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Quick Launch
          </h1>
          <p className="text-sm text-muted-foreground">
            Drag and drop a JSON config file or browse to launch a server instantly
          </p>
        </div>
      </div>

      {/* ── Validation errors ──────────────────────────────────── */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Validation errors
              </p>
              <ul className="list-inside list-disc text-xs text-destructive/80">
                {validationErrors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">{e.field}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Drop zone ──────────────────────────────────────────── */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:bg-accent/50'
        )}
      >
        <input
          type="file"
          accept=".json"
          onChange={onFileInput}
          className="hidden"
          ref={fileInputRef}
        />

        {dragOver ? (
          <Upload className="mb-3 h-10 w-10 text-primary animate-pulse" />
        ) : (
          <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {dragOver
            ? 'Drop your config file here'
            : 'Drag & drop a JSON config file here'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to browse
        </p>
      </div>

      {/* ── Config preview ─────────────────────────────────────── */}
      {config && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold">Config Preview</h2>
              {validationErrors.length === 0 && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setParsedFile(null);
                setValidationErrors([]);
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Clear config"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Model</dt>
              <dd className="mt-0.5 break-all text-sm font-medium">
                {config.model.split('/').pop()}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Port</dt>
              <dd className="mt-0.5 text-sm font-medium">{config.port}</dd>
            </div>
            {typeof previewArgs.temp === 'number' && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Temperature</dt>
                <dd className="mt-0.5 text-sm">{previewArgs.temp}</dd>
              </div>
            )}
            {typeof previewArgs.threads === 'number' && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Threads</dt>
                <dd className="mt-0.5 text-sm">{previewArgs.threads}</dd>
              </div>
            )}
            {typeof previewArgs.context_size === 'number' && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Context Size</dt>
                <dd className="mt-0.5 text-sm">{previewArgs.context_size}</dd>
              </div>
            )}
            {typeof previewArgs.gpu_layers === 'number' && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">GPU Layers</dt>
                <dd className="mt-0.5 text-sm">{previewArgs.gpu_layers}</dd>
              </div>
            )}
            {config.name && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Name</dt>
                <dd className="mt-0.5 text-sm">{config.name}</dd>
              </div>
            )}
          </dl>

          {/* ── Launch button ──────────────────────────────────── */}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleLaunch}
              disabled={isLaunching || launchMutation.isPending || validationErrors.length > 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors',
                'hover:bg-primary/90',
                (isLaunching || launchMutation.isPending || validationErrors.length > 0) &&
                  'cursor-not-allowed opacity-50'
              )}
            >
              {(isLaunching || launchMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Server className="h-4 w-4" />
                  Launch Server
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Recent configs ─────────────────────────────────────── */}
      {recentConfigs.length > 0 && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileJson className="h-4 w-4 text-blue-400" />
              Recent Configs
            </h2>
            <button
              type="button"
              onClick={handleClearRecent}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Clear all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1">
            {recentConfigs.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => handleRecentClick(name)}
              >
                <span className="flex items-center gap-2 truncate">
                  <FileJson className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{name}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => handleRecentRemove(e, name)}
                  className="ml-2 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────── */}
      {!parsedFile && recentConfigs.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Load a JSON config file to get started. Your config should include
            a <code className="rounded bg-muted px-1 py-0.5 text-xs">model</code> path and <code className="rounded bg-muted px-1 py-0.5 text-xs">port</code>.
          </p>
        </div>
      )}
    </div>
  );
}
