import { QueryClient } from '@tanstack/react-query';

// Shared singleton so it can be cleared from outside App.tsx (e.g. on logout).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
