// ─── Benchmark Types ──────────────────────────────────────────────

export interface BenchmarkConfig {
  model: string;
  n_predict: number;
  threads: number;
  context_size: number;
  temperature: number;
}

export interface BenchmarkResult {
  id: string;
  modelName: string;
  modelPath?: string;
  tokensPerSec: number;
  timePerToken: number;
  memoryUsed?: number;
  memoryTotal?: number;
  n_predict: number;
  threads: number;
  contextSize: number;
  temperature: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  timestamp: string;
}

export interface BenchmarkRunRequest {
  model: string;
  n_predict?: number;
  threads?: number;
  context_size?: number;
  temperature?: number;
}

export interface BenchmarkRunResponse {
  jobId: string;
  status: string;
  message: string;
}

export type BenchmarkPreset = {
  label: string;
  config: Omit<BenchmarkConfig, 'model'>;
};

export const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    label: 'Quick Test',
    config: { n_predict: 128, threads: 4, context_size: 512, temperature: 0.7 },
  },
  {
    label: 'Standard',
    config: { n_predict: 512, threads: 4, context_size: 2048, temperature: 0.7 },
  },
  {
    label: 'Full',
    config: { n_predict: 2048, threads: 8, context_size: 4096, temperature: 0.7 },
  },
];
