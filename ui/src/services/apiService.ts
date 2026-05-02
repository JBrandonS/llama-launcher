import type {
  ApiResponse,
  AddModelRequest,
  DaemonConfig,
  DaemonInfo,
  DownloadModelRequest,
  DownloadModelResponse,
  GpuMetricsResponse,
  LaunchConfig,
  LaunchResponse,
  LogStreamResponse,
  ModelInfo,
  ModelQuantizationsResponse,
  ModelResolveResponse,
  ModelTypeGroup,
  ServerConfig,
  ServerInfo,
  Settings,
  SystemMetrics,
  UpdateModelRequest,
  ValidationError,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8501';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error:
          data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`,
        status: res.status,
      };
    }

    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      error: `Failed to connect to ${API_BASE}: ${message}`,
      status: 0,
    };
  }
}

export const apiService = {
  // ── Servers ─────────────────────────────────────────────────
  async getServers(): Promise<ServerInfo[]> {
    const res = await request('/servers');
    return res.ok ? (res.data as ServerInfo[]) : [];
  },

  async getServer(id: string): Promise<ServerInfo | null> {
    const res = await request(`/servers/${id}`);
    return res.ok ? (res.data as ServerInfo) : null;
  },

  async launchServer(config: LaunchConfig): Promise<LaunchResponse> {
    const res = await request<LaunchResponse>('/servers', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return res.ok ? (res.data as LaunchResponse) : { serverId: '', message: '' };
  },

  async getLaunchPreview(modelPath: string, args: Record<string, unknown>): Promise<{ command: string }> {
    const res = await request<{ command: string }>('/launch/preview', {
      method: 'POST',
      body: JSON.stringify({ model: modelPath, args }),
    });
    return res.ok ? (res.data as { command: string }) : { command: '' };
  },

  async stopServer(id: string): Promise<boolean> {
    const res = await request(`/servers/${id}/stop`, { method: 'POST' });
    return res.ok;
  },

  async restartServer(id: string): Promise<boolean> {
    const res = await request(`/servers/${id}/restart`, { method: 'POST' });
    return res.ok;
  },

  async deleteServer(id: string): Promise<boolean> {
    const res = await request(`/servers/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // ── Models ──────────────────────────────────────────────────
  async getModels(): Promise<ModelInfo[]> {
    const res = await request('/models');
    return res.ok ? (res.data as ModelInfo[]) : [];
  },

  async resolveAlias(alias: string): Promise<ModelResolveResponse | null> {
    const res = await request<ModelResolveResponse>(`/models/resolve?alias=${encodeURIComponent(alias)}`);
    return res.ok ? (res.data as ModelResolveResponse) : null;
  },

  async getModelQuantizations(model: string): Promise<ModelQuantizationsResponse | null> {
    const res = await request<ModelQuantizationsResponse>(`/models/quantizations?model=${encodeURIComponent(model)}`);
    return res.ok ? (res.data as ModelQuantizationsResponse) : null;
  },

  async downloadModel(payload: DownloadModelRequest): Promise<DownloadModelResponse | null> {
    const res = await request<DownloadModelResponse>('/models/download', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.ok ? (res.data as DownloadModelResponse) : null;
  },

  async addModel(payload: AddModelRequest): Promise<ModelInfo | null> {
    const res = await request<ModelInfo>('/models', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.ok ? (res.data as ModelInfo) : null;
  },

  async updateModel(id: string, payload: UpdateModelRequest): Promise<boolean> {
    const res = await request(`/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.ok;
  },

  async deleteModel(id: string): Promise<boolean> {
    const res = await request(`/models/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  async getModelTypes(): Promise<ModelTypeGroup[]> {
    const res = await request<ModelTypeGroup[]>('/models/types');
    return res.ok ? (res.data as ModelTypeGroup[]) : [];
  },

  // ── Metrics ─────────────────────────────────────────────────
  async getMetrics(serverId?: string): Promise<SystemMetrics | null> {
    const url = serverId
      ? `/metrics?server=${serverId}`
      : '/metrics';
    const res = await request<SystemMetrics>(url);
    return res.ok ? (res.data as SystemMetrics) : null;
  },

  async getMetricsHistory(
    serverId?: string,
    limit = 100
  ): Promise<SystemMetrics[]> {
    const url = serverId
      ? `/metrics/history?server=${serverId}&limit=${limit}`
      : `/metrics/history?limit=${limit}`;
    const res = await request<SystemMetrics[]>(url);
    return res.ok ? (res.data as SystemMetrics[]) : [];
  },

  async getGpuMetrics(): Promise<GpuMetricsResponse | null> {
    const res = await request<GpuMetricsResponse>('/metrics/gpu');
    return res.ok ? (res.data as GpuMetricsResponse) : null;
  },

  // ── Daemon ──────────────────────────────────────────────────
  async getDaemonStatus(): Promise<DaemonInfo | null> {
    const res = await request<DaemonInfo>('/daemon/status');
    return res.ok ? (res.data as DaemonInfo) : null;
  },

  async startDaemon(): Promise<boolean> {
    const res = await request('/daemon/start', { method: 'POST' });
    return res.ok;
  },

  async stopDaemon(): Promise<boolean> {
    const res = await request('/daemon/stop', { method: 'POST' });
    return res.ok;
  },

  async updateDaemonConfig(config: Partial<DaemonConfig>): Promise<boolean> {
    const res = await request('/daemon/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return res.ok;
  },

  async getDaemonServiceFile(): Promise<{ content: string } | null> {
    const res = await request<{ content: string }>('/daemon/service-file');
    return res.ok ? (res.data as { content: string }) : null;
  },

  // ── Daemon Logs ─────────────────────────────────────────────
  async getDaemonLogs(limit = 200): Promise<LogStreamResponse> {
    const res = await request<LogStreamResponse>(`/daemon/logs?limit=${limit}`);
    return res.ok ? (res.data as LogStreamResponse) : { entries: [], hasMore: false };
  },

  // ── Logs ────────────────────────────────────────────────────
  async getLogs(
    serverId?: string,
    level?: string,
    limit = 200,
    cursor?: string
  ): Promise<LogStreamResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
    });
    if (serverId) params.set('server', serverId);
    if (level) params.set('level', level);
    if (cursor) params.set('cursor', cursor);

    const res = await request<LogStreamResponse>(`/logs?${params}`);
    return res.ok ? (res.data as LogStreamResponse) : { entries: [], hasMore: false };
  },

  // ── Settings ────────────────────────────────────────────────
  async getSettings(): Promise<Settings> {
    const res = await request('/settings');
    return res.ok ? (res.data as Settings) : {};
  },

  async updateSettings(settings: Partial<Settings>): Promise<boolean> {
    const res = await request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return res.ok;
  },

  // ── Validation ──────────────────────────────────────────────
  async validateLaunchConfig(config: LaunchConfig): Promise<{
    valid: boolean;
    errors: ValidationError[];
  }> {
    const res = await request<{ valid: boolean; errors: ValidationError[] }>(
      '/validate',
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    );
    if (res.ok) return res.data as { valid: boolean; errors: ValidationError[] };
    return { valid: false, errors: [{ field: 'server', message: 'Validation failed' }] };
  },

  // ── Quick Launch ────────────────────────────────────────────
  async validateConfig(config: ServerConfig): Promise<{
    valid: boolean;
    errors: ValidationError[];
  }> {
    const res = await request<{ valid: boolean; errors: ValidationError[] }>(
      '/validate/config',
      {
        method: 'POST',
        body: JSON.stringify({ config }),
      }
    );
    if (res.ok) return res.data as { valid: boolean; errors: ValidationError[] };
    return { valid: false, errors: [{ field: 'server', message: 'Validation failed' }] };
  },

  async launchFromConfig(config: ServerConfig): Promise<LaunchResponse> {
    const res = await request<LaunchResponse>('/run/config', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
    return res.ok ? (res.data as LaunchResponse) : { serverId: '', message: '' };
  },
};
