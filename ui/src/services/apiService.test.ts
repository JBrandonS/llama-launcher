import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiService } from './apiService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(data: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockNetworkError(message = 'Network error') {
  mockFetch.mockRejectedValueOnce(new Error(message));
}

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('servers', () => {
    it('getServers returns server list on success', async () => {
      mockResponse([{ id: 'srv-1', name: 'Test Server' }]);
      const result = await apiService.getServers();
      expect(result).toEqual([{ id: 'srv-1', name: 'Test Server' }]);
    });

    it('getServers returns empty array on failure', async () => {
      mockResponse(null, false, 500);
      const result = await apiService.getServers();
      expect(result).toEqual([]);
    });

    it('getServer returns server by id', async () => {
      mockResponse({ id: 'srv-1', name: 'Test' });
      const result = await apiService.getServer('srv-1');
      expect(result).toEqual({ id: 'srv-1', name: 'Test' });
    });

    it('getServer returns null on failure', async () => {
      mockResponse(null, false, 404);
      const result = await apiService.getServer('nonexistent');
      expect(result).toBeNull();
    });

    it('launchServer sends POST with config', async () => {
      mockResponse({ serverId: 'new-srv', message: 'Launched' });
      const config = { modelPath: '/models/test.gguf', port: 8501 };
      const result = await apiService.launchServer(config as any);
      expect(result).toEqual({ serverId: 'new-srv', message: 'Launched' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/servers'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('stopServer returns true on success', async () => {
      mockResponse({});
      const result = await apiService.stopServer('srv-1');
      expect(result).toBe(true);
    });

    it('restartServer returns true on success', async () => {
      mockResponse({});
      const result = await apiService.restartServer('srv-1');
      expect(result).toBe(true);
    });

    it('deleteServer returns true on success', async () => {
      mockResponse({});
      const result = await apiService.deleteServer('srv-1');
      expect(result).toBe(true);
    });
  });

  describe('models', () => {
    it('getModels returns model list', async () => {
      mockResponse([{ id: 'm1', name: 'Model 1' }]);
      const result = await apiService.getModels();
      expect(result).toEqual([{ id: 'm1', name: 'Model 1' }]);
    });

    it('getModels returns empty array on failure', async () => {
      mockResponse(null, false);
      const result = await apiService.getModels();
      expect(result).toEqual([]);
    });

    it('downloadModel sends POST and returns response', async () => {
      mockResponse({ status: 'started', modelId: 'm1' });
      const result = await apiService.downloadModel({ modelId: 'm1' } as any);
      expect(result).toEqual({ status: 'started', modelId: 'm1' });
    });

    it('downloadModel returns null on failure', async () => {
      mockResponse(null, false, 400);
      const result = await apiService.downloadModel({ modelId: 'm1' } as any);
      expect(result).toBeNull();
    });

    it('addModel sends POST and returns model', async () => {
      mockResponse({ id: 'new-m', name: 'New Model' });
      const result = await apiService.addModel({ id: 'new-m', path: '/models/new.gguf' } as any);
      expect(result).toEqual({ id: 'new-m', name: 'New Model' });
    });

    it('updateModel returns true on success', async () => {
      mockResponse({});
      const result = await apiService.updateModel('m1', { name: 'Updated' } as any);
      expect(result).toBe(true);
    });

    it('deleteModel returns true on success', async () => {
      mockResponse({});
      const result = await apiService.deleteModel('m1');
      expect(result).toBe(true);
    });

    it('getModelTypes returns type groups', async () => {
      mockResponse([{ local: [], huggingface: [], template: [] }]);
      const result = await apiService.getModelTypes();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('metrics', () => {
    it('getMetrics returns metrics', async () => {
      mockResponse({ cpu: 45, memory: 60 });
      const result = await apiService.getMetrics();
      expect(result).toEqual({ cpu: 45, memory: 60 });
    });

    it('getMetrics with serverId includes query param', async () => {
      mockResponse({ cpu: 45, memory: 60 });
      await apiService.getMetrics('srv-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('server=srv-1'),
        expect.any(Object)
      );
    });

    it('getGpuMetrics returns GPU metrics', async () => {
      mockResponse({ gpus: [{ utilization: 85 }] });
      const result = await apiService.getGpuMetrics();
      expect(result).toEqual({ gpus: [{ utilization: 85 }] });
    });

    it('getMetricsHistory returns history array', async () => {
      mockResponse([{ cpu: 45 }, { cpu: 50 }]);
      const result = await apiService.getMetricsHistory();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe('daemon', () => {
    it('getDaemonStatus returns daemon info', async () => {
      mockResponse({ status: 'running', running: true });
      const result = await apiService.getDaemonStatus();
      expect(result).toEqual({ status: 'running', running: true });
    });

    it('startDaemon returns true on success', async () => {
      mockResponse({});
      const result = await apiService.startDaemon();
      expect(result).toBe(true);
    });

    it('stopDaemon returns true on success', async () => {
      mockResponse({});
      const result = await apiService.stopDaemon();
      expect(result).toBe(true);
    });

    it('updateDaemonConfig sends PUT with config', async () => {
      mockResponse({});
      const result = await apiService.updateDaemonConfig({ pollIntervalSeconds: 30 });
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/daemon/config'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('getDaemonServiceFile returns content', async () => {
      mockResponse({ content: '[Unit]\nDescription=Test' });
      const result = await apiService.getDaemonServiceFile();
      expect(result).toEqual({ content: '[Unit]\nDescription=Test' });
    });

    it('getDaemonLogs returns log entries', async () => {
      mockResponse({ entries: [{ message: 'test' }], hasMore: false });
      const result = await apiService.getDaemonLogs();
      expect(result.entries).toHaveLength(1);
    });

    it('getDaemonSystemdStatus returns systemd info', async () => {
      mockResponse({ exists: true, active: true, sub: 'running', pid: 1234, error: null });
      const result = await apiService.getDaemonSystemdStatus();
      expect(result).toEqual({ exists: true, active: true, sub: 'running', pid: 1234, error: null });
    });

    it('getDaemonSystemdUnit returns unit info', async () => {
      mockResponse({ content: '[Unit]\n', path: '/etc/systemd/...', exists: true });
      const result = await apiService.getDaemonSystemdUnit();
      expect(result).toEqual({ content: '[Unit]\n', path: '/etc/systemd/...', exists: true });
    });
  });

  describe('logs', () => {
    it('getLogs returns log entries', async () => {
      mockResponse({ entries: [{ message: 'test' }], hasMore: false });
      const result = await apiService.getLogs();
      expect(result.entries).toHaveLength(1);
    });

    it('getLogs with serverId includes query param', async () => {
      mockResponse({ entries: [], hasMore: false });
      await apiService.getLogs('srv-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('server=srv-1'),
        expect.any(Object)
      );
    });

    it('getLogs with level includes query param', async () => {
      mockResponse({ entries: [], hasMore: false });
      await apiService.getLogs(undefined, 'ERROR');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('level=ERROR'),
        expect.any(Object)
      );
    });
  });

  describe('settings', () => {
    it('getSettings returns settings', async () => {
      mockResponse({ theme: 'dark' });
      const result = await apiService.getSettings();
      expect(result).toEqual({ theme: 'dark' });
    });

    it('getSettings returns empty object on failure', async () => {
      mockResponse(null, false);
      const result = await apiService.getSettings();
      expect(result).toEqual({});
    });

    it('updateSettings sends PUT and returns true', async () => {
      mockResponse({});
      const result = await apiService.updateSettings({ logLevel: 'debug' });
      expect(result).toBe(true);
    });
  });

  describe('validation', () => {
    it('validateLaunchConfig returns valid config', async () => {
      mockResponse({ valid: true, errors: [] });
      const result = await apiService.validateLaunchConfig({ modelPath: '/models/test.gguf' } as any);
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('validateLaunchConfig returns errors on invalid', async () => {
      mockResponse({ valid: false, errors: [{ field: 'model', message: 'Required' }] });
      const result = await apiService.validateLaunchConfig({} as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('validateLaunchConfig returns error on network failure', async () => {
      mockNetworkError('Failed to connect');
      const result = await apiService.validateLaunchConfig({ modelPath: '/models/test.gguf' } as any);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('server');
    });

    it('validateConfig returns valid config', async () => {
      mockResponse({ valid: true, errors: [] });
      const result = await apiService.validateConfig({} as any);
      expect(result.valid).toBe(true);
    });

    it('launchFromConfig sends POST and returns response', async () => {
      mockResponse({ serverId: 'new-srv', message: 'Launched' });
      const result = await apiService.launchFromConfig({} as any);
      expect(result.serverId).toBe('new-srv');
    });
  });

  describe('benchmark', () => {
    it('benchmarkRun sends POST and returns response', async () => {
      mockResponse({ jobId: 'bench-1', status: 'running' });
      const result = await apiService.benchmarkRun({ model_paths: ['/models/test.gguf'] } as any);
      expect(result).toEqual({ jobId: 'bench-1', status: 'running' });
    });

    it('benchmarkRun returns null on failure', async () => {
      mockResponse(null, false, 500);
      const result = await apiService.benchmarkRun({ model_paths: ['/models/test.gguf'] } as any);
      expect(result).toBeNull();
    });

    it('getBenchmarkResults returns results array', async () => {
      mockResponse([{ name: 'test', score: 85 }]);
      const result = await apiService.getBenchmarkResults();
      expect(Array.isArray(result)).toBe(true);
    });

    it('clearBenchmarkResults returns true on success', async () => {
      mockResponse({});
      const result = await apiService.clearBenchmarkResults();
      expect(result).toBe(true);
    });

    it('loadBenchmarkIni loads INI file successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ config: { gpu_layers: 32 } }),
      });
      const file = new File(['test'], 'test.ini');
      const result = await apiService.loadBenchmarkIni(file);
      expect(result.ok).toBe(true);
      expect(result.config).toEqual({ gpu_layers: 32 });
    });

    it('loadBenchmarkIni returns error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid INI' }),
      });
      const file = new File(['test'], 'test.ini');
      const result = await apiService.loadBenchmarkIni(file);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Invalid INI');
    });

    it('getBenchmarkTypes returns benchmark types', async () => {
      mockResponse([{ id: 'perplexity', label: 'Perplexity' }]);
      const result = await apiService.getBenchmarkTypes();
      expect(Array.isArray(result)).toBe(true);
    });

    it('benchmarkMultiRun sends POST and returns response', async () => {
      mockResponse({ jobId: 'multi-1', status: 'running' });
      const result = await apiService.benchmarkMultiRun({
        model_paths: ['/models/test.gguf'],
        benchmark_ids: ['perplexity'],
      });
      expect(result.jobId).toBe('multi-1');
    });

    it('getSavedBenchmarkResults returns saved results', async () => {
      mockResponse([{ name: 'test-bench', timestamp: '2024-01-01' }]);
      const result = await apiService.getSavedBenchmarkResults();
      expect(Array.isArray(result)).toBe(true);
    });

    it('getFullBenchmarkResult returns full report', async () => {
      mockResponse({ model_path: '/models/test.gguf', benchmarks: {} });
      const result = await apiService.getFullBenchmarkResult('test-bench');
      expect(result).toEqual({ model_path: '/models/test.gguf', benchmarks: {} });
    });

    it('clearSavedBenchmarkResults returns true on success', async () => {
      mockResponse({});
      const result = await apiService.clearSavedBenchmarkResults();
      expect(result).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('getLaunchPreview returns command', async () => {
      mockResponse({ command: 'llama-server -m /models/test.gguf' });
      const result = await apiService.getLaunchPreview('/models/test.gguf', {});
      expect(result.command).toBe('llama-server -m /models/test.gguf');
    });

    it('getLaunchIni returns ini content', async () => {
      mockResponse({ ini: '[model]\npath=/models/test.gguf' });
      const result = await apiService.getLaunchIni('/models/test.gguf', {});
      expect(result.ini).toBe('[model]\npath=/models/test.gguf');
    });
  });

  describe('error handling', () => {
    it('getServers handles network error', async () => {
      mockNetworkError('ECONNREFUSED');
      const result = await apiService.getServers();
      expect(result).toEqual([]);
    });

    it('launchServer handles network error', async () => {
      mockNetworkError('ECONNREFUSED');
      const result = await apiService.launchServer({ modelPath: '/models/test.gguf' } as any);
      expect(result.serverId).toBe('');
    });
  });
});
