// ─── Server Types ──────────────────────────────────────────────
export interface ServerInfo {
  id: string;
  name?: string;
  port?: number;
  status: string; // 'running' | 'starting' | 'stopping' | 'stopped'
  model?: string;
  gpuInfo?: GPUInfo;
  tokenUsage?: TokenUsage;
  uptimeSeconds?: number;
  launchConfig?: Record<string, unknown>;
}

export interface GPUInfo {
  index?: number;
  model?: string;
  memoryUsed?: number;
  memoryTotal?: number;
  memoryFree?: number;
  utilization?: number;
  temperature?: number;
  powerUsage?: number;
  powerLimit?: number;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptTime?: number;
  completionTime?: number;
  timePerToken?: number;
}

// ─── Model Types ──────────────────────────────────────────────
export interface QuantizationInfo {
  tag: string;
  size?: string;
  filename?: string;
  isRecommended?: boolean;
}

export type ModelType = 'local' | 'huggingface' | 'template';

export interface ModelInfo {
  id: string;
  path: string;
  size_bytes: number;
  size_human: string;
  last_modified: string;
  tags: string[];
  type?: ModelType;
  aliases?: string[];
  quantizations?: QuantizationInfo[];
}

export interface ModelTypeGroup {
  type: string;
  models: ModelInfo[];
}

export interface AddModelRequest {
  path: string;
  name?: string;
  aliases?: string[];
}

export interface UpdateModelRequest {
  name?: string;
  aliases?: string[];
}

export interface ModelResolveResponse {
  alias: string;
  resolved: string;
}

export interface ModelQuantizationsResponse {
  model: string;
  quantizations: QuantizationInfo[];
}

export interface DownloadModelRequest {
  model: string;
  quantization?: string;
}

export interface DownloadModelResponse {
  status: string;
  message: string;
  model?: string;
  quantization?: string;
}

// ─── Metrics Types ─────────────────────────────────────────────
export interface SystemMetrics {
  timestamp: string;
  system?: SystemResources;
  gpu?: GPUResources;
  gpuAvailable?: boolean;
  serverId?: string;
}

export interface SystemResources {
  cpuPercent?: number;
  memoryPercent?: number;
  memoryUsed?: number;
  memoryTotal?: number;
  diskPercent?: number;
  diskUsed?: number;
  diskTotal?: number;
  loadAverage?: [number, number, number];
}

export interface GPUResources {
  utilization?: number;
  memoryUsed?: number;
  memoryTotal?: number;
  temperature?: number;
  powerUsage?: number;
  powerLimit?: number;
  fanSpeed?: number;
  name?: string;
}

// ─── GPU Metrics Types (from /metrics/gpu endpoint) ────────────
export interface GpuMetricsResponse {
  gpuAvailable: boolean;
  backend: string;
  gpus: GpuDetail[];
  aggregate?: {
    memoryUsed?: number;
    memoryTotal?: number;
    utilization?: number;
    temperature?: number;
  };
}

export interface GpuDetail {
  name: string;
  index: number;
  utilization: number;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number;
  powerUsage?: number;
  powerLimit?: number;
  fanSpeed?: number;
}

// ─── Daemon Types ──────────────────────────────────────────────
export interface DaemonInfo {
  pid?: number;
  status: string; // 'running' | 'stopped' | 'error'
  uptimeSeconds?: number;
  lastChecked: string;
  monitoredServers: MonitoredServer[];
  config?: DaemonConfig;
  errors?: string[];
}

export interface MonitoredServer {
  id: string;
  name?: string;
  autoLaunch: boolean;
  status: string;
  lastCheck?: string;
  lastLaunchFailure?: string;
  launchCount?: number;
}

export interface DaemonConfig {
  pollIntervalSeconds?: number;
  autoLaunchOnStart?: boolean;
  maxLaunchAttempts?: number;
  retryDelaySeconds?: number;
  healthCheckInterval?: number;
  env?: Record<string, string>;
}

// ─── Settings Types ────────────────────────────────────────────
export interface Settings {
  apiPort?: number;
  logLevel?: string;
  logFile?: string;
  maxConcurrentServers?: number;
  defaultGpu?: string;
  envVariables?: Record<string, string>;
  modelCacheDir?: string;
  launchTimeout?: number;
}

// ─── Log Types ─────────────────────────────────────────────────
export interface LogEntry {
  timestamp: string;
  level: string; // 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  serverId?: string;
  component?: string;
  message: string;
}

export interface LogStreamResponse {
  entries: LogEntry[];
  hasMore: boolean;
  cursor?: string;
}

// ─── API Response Types ────────────────────────────────────────
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface LaunchConfig {
  model: string;
  port: number;
  gpuIndex?: number;
  args?: Record<string, unknown>;
  env?: Record<string, string>;
}

export interface LaunchResponse {
  serverId: string;
  message: string;
}

// ─── Error Types ───────────────────────────────────────────────
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type ErrorType =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'UNKNOWN';

export interface ValidationError {
  field: string;
  message: string;
}

// ─── Config File Types ─────────────────────────────────────────
export interface ServerConfig {
  name?: string;
  model: string;
  port: number;
  args?: Record<string, unknown>;
  env?: Record<string, string>;
}
