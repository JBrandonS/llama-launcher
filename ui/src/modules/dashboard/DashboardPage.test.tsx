import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

// Mock apiService
vi.mock('@services/apiService', () => ({
  apiService: {
    getServers: vi.fn(),
    getMetrics: vi.fn(),
    getMetricsHistory: vi.fn(),
    getGpuMetrics: vi.fn(),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('shows heading and description', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60, diskPercent: 30 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/overview of all servers/i)).toBeInTheDocument();
  });

  it('shows tab navigation', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('shows total servers stat card', async () => {
    queryClient.setQueryData(['servers'], [
      { id: 'srv-1', name: 'Server 1', status: 'running' },
      { id: 'srv-2', name: 'Server 2', status: 'stopped' },
    ]);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Total Servers')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/running: 1/i)).toBeInTheDocument();
  });

  it('shows running servers stat card', async () => {
    queryClient.setQueryData(['servers'], [
      { id: 'srv-1', name: 'Server 1', status: 'running' },
    ]);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows CPU usage stat card', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 72.5, memoryPercent: 60 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    const cpuValues = screen.getAllByText(/72\.5%/);
    expect(cpuValues.length).toBeGreaterThan(0);
  });

  it('shows memory usage stat card', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], {
      system: { cpuPercent: 45, memoryPercent: 65.3, memoryUsed: 10737418240, memoryTotal: 17179869184 },
    });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    const memValues = screen.getAllByText(/65\.3%/);
    expect(memValues.length).toBeGreaterThan(0);
  });

  it('shows GPU utilization card when GPU available', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });
    queryClient.setQueryData(['gpu-metrics'], { gpuAvailable: true, backend: 'cuda', aggregate: { utilization: 45.5, memoryUsed: 4294967296, memoryTotal: 8589934592 }, gpus: [{ name: 'NVIDIA A100', index: 0 }] });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('GPU Utilization')).toBeInTheDocument();
    const gpuUtilValues = screen.getAllByText(/45\.5%/);
    expect(gpuUtilValues.length).toBeGreaterThan(0);
  });

  it('shows GPU memory card when GPU available', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });
    queryClient.setQueryData(['gpu-metrics'], { gpuAvailable: true, aggregate: { utilization: 50, memoryUsed: 4294967296, memoryTotal: 8589934592 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('GPU Memory')).toBeInTheDocument();
    const gpuMemValues = screen.getAllByText(/50%/);
    expect(gpuMemValues.length).toBeGreaterThan(0);
  });

  it('shows GPU temperature card when GPU available', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });
    queryClient.setQueryData(['gpu-metrics'], { gpuAvailable: true, aggregate: { utilization: 50, temperature: 72 }, gpus: [{ name: 'GPU 0' }] });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('GPU Temperature')).toBeInTheDocument();
    const tempValues = screen.getAllByText(/72°C/);
    expect(tempValues.length).toBeGreaterThan(0);
  });

  it('shows disk usage card', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60, diskPercent: 55.2 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Disk Usage')).toBeInTheDocument();
    const diskValues = screen.getAllByText(/55\.2%/);
    expect(diskValues.length).toBeGreaterThan(0);
  });

  it('shows total tokens card', async () => {
    queryClient.setQueryData(['servers'], [
      { id: 'srv-1', name: 'Server 1', status: 'running', tokenUsage: { totalTokens: 1500 } },
      { id: 'srv-2', name: 'Server 2', status: 'running', tokenUsage: { totalTokens: 2500 } },
    ]);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('4,000')).toBeInTheDocument();
  });

  it('shows resource usage section', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60, diskPercent: 30 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Resource Usage')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Disk')).toBeInTheDocument();
  });

  it('shows GPU details section when GPU available', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });
    queryClient.setQueryData(['gpu-metrics'], { gpuAvailable: true, backend: 'cuda', gpus: [{ name: 'NVIDIA A100', index: 0, utilization: 45 }] });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('GPU Details')).toBeInTheDocument();
  });

  it('shows resource history chart', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });
    queryClient.setQueryData(['metrics-history'], [
      { timestamp: '2024-01-01', system: { cpuPercent: 45, memoryPercent: 60 }, gpu: { utilization: 30 } },
      { timestamp: '2024-01-02', system: { cpuPercent: 50, memoryPercent: 65 }, gpu: { utilization: 40 } },
    ]);

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Resource History (60 samples)')).toBeInTheDocument();
  });

  it('shows servers tab with top servers table', async () => {
    queryClient.setQueryData(['servers'], [
      { id: 'srv-1', name: 'Server 1', status: 'running', tokenUsage: { totalTokens: 5000 } },
      { id: 'srv-2', name: 'Server 2', status: 'running', tokenUsage: { totalTokens: 3000 } },
    ]);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });

    // Click on Servers tab
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.trim() === 'Servers') {
        fireEvent.click(btn);
        break;
      }
    }
    expect(screen.getByText('Top Servers by Token Usage')).toBeInTheDocument();
  });

  it('shows GPU error state', async () => {
    queryClient.setQueryData(['servers'], []);
    queryClient.setQueryData(['metrics'], { system: { cpuPercent: 45, memoryPercent: 60 } });
    // Set an error in the query cache for gpu-metrics
    queryClient.setQueryData(['gpu-metrics'], undefined);

    render(<DashboardPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('GPU Utilization')).toBeInTheDocument();
  });
});
