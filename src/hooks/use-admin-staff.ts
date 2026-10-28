import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStaffApi, type ActivityParams, type StaffMember } from '@/lib/api/admin-staff';
import { ApiError, parseError } from '@/lib/errors';

export const STAFF_KEY = ['admin-staff'] as const;
export const ACTIVITY_KEY = ['admin-staff-activity'] as const;

export function useStaff() {
  return useQuery({ queryKey: STAFF_KEY, queryFn: adminStaffApi.list, staleTime: 30_000, retry: false, refetchOnWindowFocus: true });
}

export function useStaffCache() {
  const qc = useQueryClient();
  return {
    refresh: () => Promise.all([qc.invalidateQueries({ queryKey: STAFF_KEY }), qc.invalidateQueries({ queryKey: ACTIVITY_KEY })]),
    /** Updates one person in place so a switch feels instant; returns an undo for when the request fails. */
    patch(id: string, patch: Partial<StaffMember>): () => void {
      const prev = qc.getQueryData<StaffMember[]>(STAFF_KEY)?.find((m) => m.id === id);
      qc.setQueryData<StaffMember[]>(STAFF_KEY, (rows) => rows?.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      return () => {
        if (!prev) return;
        const restore = Object.fromEntries(Object.keys(patch).map((k) => [k, prev[k as keyof StaffMember]]));
        qc.setQueryData<StaffMember[]>(STAFF_KEY, (rows) => rows?.map((m) => (m.id === id ? { ...m, ...restore } : m)));
      };
    },
  };
}

/** The log, 25 lines at a time. Filters are passed to the server. */
export function useActivity(filters: Omit<ActivityParams, 'page'>) {
  return useInfiniteQuery({
    queryKey: [...ACTIVITY_KEY, filters],
    queryFn: ({ pageParam }) => adminStaffApi.activity({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasNext ? all.length + 1 : undefined),
    retry: false,
    staleTime: 15_000,
  });
}

/** True when the server has no activity log (the stock backend doesn't). */
export function activityUnavailable(e: unknown): boolean {
  const err = parseError(e);
  return err instanceof ApiError && (err.status === 404 || err.status === 405);
}

export function staffError(e: unknown): string {
  const err = parseError(e);
  if (err.status === 403) return "The server didn't allow that change for your account.";
  return err.display;
}
