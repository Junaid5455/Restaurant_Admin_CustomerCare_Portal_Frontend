import { useQuery } from '@tanstack/react-query';
import { loadDashboard } from '@/lib/api/admin-dashboard';

export const DASHBOARD_KEY = ['owner-dashboard'] as const;

/** A live board: refreshes every 30 seconds and when the owner comes back to the tab. */
export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: loadDashboard,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    retry: false,
  });
}
