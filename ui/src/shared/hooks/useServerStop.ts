import { useServerMutation } from '@shared/hooks/useServerMutation';
import { apiService } from '@services/apiService';
import type { ServerInfo } from '@services/types';

/**
 * Hook to stop a server with confirmation dialog.
 * Returns { isLoading, onStop } for use in components.
 */
export function useServerStop(server: ServerInfo) {
  const { trigger: stopServer, isLoading } = useServerMutation({
    mutationFn: () => apiService.stopServer(server.id),
    queryKeys: [['servers']],
    successMessage: 'Server stopped',
    errorMessage: 'Failed to stop server',
  });

  const onStop = () => {
    if (window.confirm(`Stop ${server.name || server.id}? This action will terminate the server process.`)) {
      stopServer();
    }
  };

  return { isLoading, onStop };
}
