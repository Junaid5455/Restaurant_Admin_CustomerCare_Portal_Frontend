import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { superAdminApi, type PlatformRestaurant, type PlatformUser } from '@/lib/api/super-admin';

export const SA = {
  summary: ['sa-summary'] as const,
  users: ['sa-users'] as const,
  restaurants: ['sa-restaurants'] as const,
  orders: ['sa-orders'] as const,
  tickets: ['sa-tickets'] as const,
};

const base = { retry: false, staleTime: 30_000, refetchOnWindowFocus: true } as const;

export const useSummary = () => useQuery({ queryKey: SA.summary, queryFn: superAdminApi.summary, ...base });
export const usePlatformUsers = () => useQuery({ queryKey: SA.users, queryFn: superAdminApi.users, ...base });
export const usePlatformRestaurants = () => useQuery({ queryKey: SA.restaurants, queryFn: superAdminApi.restaurants, ...base });
export const usePlatformOrders = () => useQuery({ queryKey: SA.orders, queryFn: superAdminApi.orders, ...base });
export const useAllTickets = () => useQuery({ queryKey: SA.tickets, queryFn: superAdminApi.tickets, ...base, refetchInterval: 60_000 });

/** Flips a user's active flag. The server only offers a toggle, so we trust its answer rather than our guess. */
export function useToggleUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => superAdminApi.toggleUser(id),
    onSuccess: (res) => {
      qc.setQueryData<PlatformUser[]>(SA.users, (rows) => rows?.map((u) => (u.id === res.id ? { ...u, is_active: res.is_active } : u)));
      void qc.invalidateQueries({ queryKey: SA.summary });
    },
  });
}

export function useToggleRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => superAdminApi.toggleRestaurant(id),
    onSuccess: (res) => {
      qc.setQueryData<PlatformRestaurant[]>(SA.restaurants, (rows) => rows?.map((r) => (r.id === res.id ? { ...r, is_active: res.is_active } : r)));
      void qc.invalidateQueries({ queryKey: SA.summary });
    },
  });
}
