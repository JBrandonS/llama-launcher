import { AppError, ValidationError } from './types';

export const errorService = {
  handleApiError(response: { ok: boolean; error?: string; status?: number }): AppError {
    if (response.ok) return new AppError('Unexpected success', 'UNKNOWN', 200);

    const status = response.status || 0;
    const code = this.mapStatusCode(status);
    return new AppError(response.error || 'An unknown error occurred', code, status);
  },

  handleFetchError(err: unknown): AppError {
    const message =
      err instanceof Error ? err.message : 'Network connection failed';
    return new AppError(message, 'NETWORK', 0);
  },

  mapStatusCode(status: number): string {
    switch (status) {
      case 0:
        return 'NETWORK';
      case 400:
        return 'VALIDATION';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 408:
        return 'TIMEOUT';
      case 500:
        return 'SERVER_ERROR';
      default:
        return 'UNKNOWN';
    }
  },

  displayError(error: AppError): string {
    switch (error.code) {
      case 'NETWORK':
        return 'Unable to connect to server. Check your connection.';
      case 'TIMEOUT':
        return 'Request timed out. Please try again.';
      case 'NOT_FOUND':
        return 'The requested resource was not found.';
      case 'CONFLICT':
        return 'A server with this configuration is already running.';
      case 'VALIDATION':
        return 'Invalid configuration. Please check your settings.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  },

  validateServerConfig(config: Record<string, unknown>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!config.model || typeof config.model !== 'string') {
      errors.push({ field: 'model', message: 'Model path is required' });
    }

    if (!config.port || typeof config.port !== 'number' || config.port < 1024 || config.port > 65535) {
      errors.push({ field: 'port', message: 'Valid port (1024-65535) is required' });
    }

    if (config.gpuIndex !== undefined) {
      if (typeof config.gpuIndex !== 'number' || config.gpuIndex < 0) {
        errors.push({ field: 'gpuIndex', message: 'GPU index must be a non-negative number' });
      }
    }

    return errors;
  },
};
