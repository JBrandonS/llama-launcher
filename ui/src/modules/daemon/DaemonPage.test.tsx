import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DaemonPage } from './DaemonPage';

// Mock apiService
vi.mock('@services/apiService', () => ({
  apiService: {
    getDaemonStatus: vi.fn(),
    startDaemon: vi.fn(),
    stopDaemon: vi.fn(),
    updateDaemonConfig: vi.fn(),
    getDaemonLogs: vi.fn(),
    getDaemonServiceFile: vi.fn(),
    getDaemonSystemdStatus: vi.fn(),
    getDaemonSystemdUnit: vi.fn(),
  },
}));

// Mock useLogSubscription hook
vi.mock('@shared/hooks/useLogSubscription', () => ({
  useLogSubscription: vi.fn(),
}));

// Mock sonner toasts
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { apiService } from '@services/apiService';

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/daemon']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DaemonPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', async () => {
    // Don't set any data — will show loader
    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    // Check for the loading state by looking for the page content not being rendered
    await waitFor(() => {
      const heading = screen.queryByText('Auto-Launch Daemon');
      expect(heading).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('renders heading and description', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      servicePath: null,
      monitoredServers: [],
      errors: [],
      config: { autoLaunchOnStart: true, pollIntervalSeconds: 10 },
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Auto-Launch Daemon')).toBeInTheDocument();
    expect(screen.getByText(/monitor and control the background daemon/i)).toBeInTheDocument();
  });

  it('shows refresh button', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('shows running status badge when daemon is running', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 1234,
      uptimeSeconds: 3600,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText(/uptime/i)).toBeInTheDocument();
  });

  it('shows stopped status badge when daemon is stopped', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('stopped')).toBeInTheDocument();
  });

  it('shows start button when daemon is stopped', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('disables start button when daemon is running', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 1234,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    const startBtn = screen.getByText('Start');
    expect(startBtn).toHaveAttribute('disabled');
  });

  it('shows stop button when daemon is running', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 1234,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('disables stop button when daemon is stopped', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    const stopBtn = screen.getByText('Stop');
    expect(stopBtn).toHaveAttribute('disabled');
  });

  it('shows monitored servers when present', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 1234,
      uptimeSeconds: 0,
      monitoredServers: [
        { id: 'srv-1', name: 'Test Server', status: 'running', autoLaunch: true },
      ],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Monitored Servers (1)')).toBeInTheDocument();
    expect(screen.getByText('Test Server')).toBeInTheDocument();
  });

  it('shows error banner when errors exist', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'error',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: ['Failed to connect to model server'],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Recent Errors')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to model server')).toBeInTheDocument();
  });

  it('shows auto-launch policy section when config exists', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {
        autoLaunchOnStart: true,
        pollIntervalSeconds: 10,
        maxLaunchAttempts: 5,
        retryDelaySeconds: 5,
        healthCheckInterval: 5,
      },
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Auto-Launch Policy')).toBeInTheDocument();
    expect(screen.getByText('Poll Interval (seconds)')).toBeInTheDocument();
    expect(screen.getByText('Max Launch Attempts')).toBeInTheDocument();
  });

  it('shows systemd section when daemon is running', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 1234,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    // Systemd section should be visible since daemon is running
    expect(screen.getByText('Systemd Service')).toBeInTheDocument();
  });

  it('shows service file section when daemon is running', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 1234,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText('Service File')).toBeInTheDocument();
  });

  it('does not show systemd/service sections when daemon is stopped', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    // These sections should not appear when daemon is stopped
    expect(screen.queryByText('Systemd Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Service File')).not.toBeInTheDocument();
  });

  it('shows PID when available', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'running',
      running: true,
      pid: 9999,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.getByText(/PID: 9999/)).toBeInTheDocument();
  });

  it('does not show PID when null', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'stopped',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    expect(screen.queryByText(/PID:/)).not.toBeInTheDocument();
  });

  it('shows error variant badge for error status', async () => {
    queryClient.setQueryData(['daemon'], {
      status: 'error',
      running: false,
      pid: null,
      uptimeSeconds: 0,
      monitoredServers: [],
      errors: [],
      config: {},
    });

    render(<DaemonPage />, { wrapper: createWrapper(queryClient) });
    const errorBadge = screen.getByText('error');
    expect(errorBadge.className).toContain('destructive');
  });
});
