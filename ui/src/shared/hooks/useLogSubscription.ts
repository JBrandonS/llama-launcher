import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsService } from '@services/wsService';
import type { LogEntry } from '@services/types';

interface UseLogSubscriptionOptions {
  serverId: string;
  enabled: boolean;
  cacheKey: unknown[];
}

/**
 * Subscribe to WebSocket log updates for a given server/daemon.
 * Appends incoming entries to a React Query cache key.
 */
export function useLogSubscription({ serverId, enabled, cacheKey }: UseLogSubscriptionOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const sub = wsService.subscribeToLogs(serverId, (entry: LogEntry) => {
      queryClient.setQueryData(cacheKey, (old: LogEntry[] = []) => [...old, entry]);
    });

    return () => sub?.();
  }, [serverId, enabled, cacheKey, queryClient]);
}
