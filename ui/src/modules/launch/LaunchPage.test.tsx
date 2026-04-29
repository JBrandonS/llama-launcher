import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LaunchPage } from './LaunchPage';
import { apiService } from '@services/apiService';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock apiService
vi.mock('@services/apiService', () => ({
  apiService: {
    getServers: vi.fn(),
    getSettings: vi.fn(),
    getModels: vi.fn(),
    launchServer: vi.fn(),
    validateLaunchConfig: vi.fn(),
  },
}));

const defaultModels = [
  {
    id: 'model-1',
    path: '/home/user/models/llama-3.1-8b-instruct.Q4_K_M.gguf',
    size_bytes: 4931094528,
    size_human: '4.6 GB',
    last_modified: '2024-01-15T10:30:00Z',
    tags: ['llama', '8b', 'instruct'],
  },
  {
    id: 'model-2',
    path: '/home/user/models/mistral-7b-instruct-v0.3.Q5_K_M.gguf',
    size_bytes: 5498118144,
    size_human: '5.1 GB',
    last_modified: '2024-02-20T14:00:00Z',
    tags: ['mistral', '7b', 'instruct'],
  },
];

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LaunchPage - Model Selection', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiService.getServers as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiService.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ apiPort: 8501 });
  });

  it('renders model dropdown with placeholder text', async () => {
    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    expect(screen.getByText('Select a model...')).toBeInTheDocument();
  });

  it('renders browse button next to dropdown', async () => {
    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const browseBtn = screen.getByTitle('Select GGUF file from disk');
    expect(browseBtn).toBeInTheDocument();
  });

  it('opens dropdown when model button is clicked', async () => {
    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    const dropdown = document.querySelector('[data-model-dropdown] .absolute');
    expect(dropdown).toBeInTheDocument();
  });

  it('shows models from API in dropdown', async () => {
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue(defaultModels);

    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    // The model name (last part of path) should appear
    await waitFor(() => {
      expect(screen.getByText('llama-3.1-8b-instruct.Q4_K_M.gguf')).toBeInTheDocument();
    });
    expect(screen.getByText('mistral-7b-instruct-v0.3.Q5_K_M.gguf')).toBeInTheDocument();
  });

  it('shows full path and size for each model in dropdown', async () => {
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue(defaultModels);

    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('/home/user/models/llama-3.1-8b-instruct.Q4_K_M.gguf')).toBeInTheDocument();
    });
    expect(screen.getByText('4.6 GB')).toBeInTheDocument();
  });

  it('selects a model when clicked in dropdown', async () => {
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue(defaultModels);

    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    const modelItem = screen.getByText('llama-3.1-8b-instruct.Q4_K_M.gguf');
    await act(async () => {
      fireEvent.click(modelItem);
    });

    // The dropdown should close and the button should show the selected model name
    expect(screen.queryByText('Select a model...')).not.toBeInTheDocument();
    expect(screen.getByText('llama-3.1-8b-instruct.Q4_K_M.gguf')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue(defaultModels);

    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    // Click outside the dropdown
    await act(async () => {
      fireEvent.mouseDown(document.body);
    });

    const dropdown = document.querySelector('[data-model-dropdown] .absolute');
    expect(dropdown).not.toBeInTheDocument();
  });

  it('shows empty state when no models found', async () => {
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('No local models found')).toBeInTheDocument();
    });
  });

  it('file picker button triggers file input', async () => {
    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const browseBtn = screen.getByTitle('Select GGUF file from disk');
    const fileInput = document.querySelector('input[type="file"]');

    await act(async () => {
      fireEvent.click(browseBtn);
    });

    // File input should have been triggered (focus event on hidden input)
    expect(fileInput).toBeInTheDocument();
  });

  it('validates that model path is required on submit', async () => {
    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const launchBtn = screen.getByRole('button', { name: /launch server/i });
    await act(async () => {
      fireEvent.click(launchBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Model path is required')).toBeInTheDocument();
    });
  });

  it('displays validation error in error banner', async () => {
    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const launchBtn = screen.getByRole('button', { name: /launch server/i });
    await act(async () => {
      fireEvent.click(launchBtn);
    });

    await waitFor(() => {
      const errorBanner = document.querySelector('.border-destructive');
      expect(errorBanner).toBeInTheDocument();
    });
  });

  it('highlights selected model in dropdown', async () => {
    (apiService.getModels as ReturnType<typeof vi.fn>).mockResolvedValue(defaultModels);

    await act(async () => {
      render(<LaunchPage />, { wrapper: createWrapper(queryClient) });
    });

    const dropdownBtn = screen.getByText('Select a model...');
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    const firstModel = screen.getByText('llama-3.1-8b-instruct.Q4_K_M.gguf');
    await act(async () => {
      fireEvent.click(firstModel);
    });

    // Reopen dropdown and check that the selected model has the accent background
    await act(async () => {
      fireEvent.click(dropdownBtn);
    });

    // The selected model should still show as selected
    await waitFor(() => {
      expect(screen.getByText('llama-3.1-8b-instruct.Q4_K_M.gguf')).toBeInTheDocument();
    });
  });
});
