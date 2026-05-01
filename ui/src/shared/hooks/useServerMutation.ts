import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ServerMutationOptions {
  mutationFn: () => Promise<unknown>;
  queryKeys: string[][];
  successMessage?: string;
  errorMessage?: string;
}

export function useServerMutation(options: ServerMutationOptions) {
  const queryClient = useQueryClient();
  const { mutationFn, queryKeys, successMessage, errorMessage } = options;

  const { mutate, isPending } = useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of queryKeys) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (successMessage) toast.success(successMessage);
    },
    onError: () => {
      if (errorMessage) toast.error(errorMessage);
    },
  });

  return { trigger: mutate, isLoading: isPending };
}
