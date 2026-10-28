import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminDeliveryApi, type AdminDelivery } from '@/lib/api/admin-delivery';
import { adminOrdersApi } from '@/lib/api/admin-orders';
import { ApiError, parseError } from '@/lib/errors';
import type { Step } from '@/lib/delivery';

export const DELIVERIES_KEY = ['dl-list'] as const;
export const DELIVERY_KEY = (id: string) => ['dl', id] as const;
export const DELIVERY_ORDERS_KEY = ['dl-orders'] as const;
const BLOCKED_KEY = ['dl-step-blocked'] as const;

/** How often the boards refresh themselves. A driver's pin moves, so this is what makes the map "live". */
export const LIVE_MS = 15_000;

export function useDeliveries() {
  return useQuery({ queryKey: DELIVERIES_KEY, queryFn: adminDeliveryApi.list, retry: false, staleTime: 10_000, refetchInterval: LIVE_MS, refetchOnWindowFocus: true });
}

export function useDelivery(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: DELIVERY_KEY(id),
    queryFn: () => adminDeliveryApi.get(id),
    retry: false,
    staleTime: 5_000,
    refetchInterval: LIVE_MS,
    initialData: () => qc.getQueryData<{ rows: AdminDelivery[] }>(DELIVERIES_KEY)?.rows.find((d) => d.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(DELIVERIES_KEY)?.dataUpdatedAt,
  });
}

/** Delivery orders, to spot the ones that have no delivery record yet. A failure here only hides that panel. */
export function useDeliveryOrders() {
  return useQuery({
    queryKey: DELIVERY_ORDERS_KEY,
    queryFn: () => adminOrdersApi.list({ order_type: 'DELIVERY', page_size: 100 }),
    retry: false,
    staleTime: 30_000,
    refetchInterval: LIVE_MS * 2,
  });
}

/** Puts a fresh copy of one delivery into the list and the detail cache. */
export function useDeliveryCache() {
  const qc = useQueryClient();
  return {
    put(next: AdminDelivery) {
      qc.setQueryData<{ rows: AdminDelivery[]; complete: boolean }>(DELIVERIES_KEY, (cur) => (cur ? { ...cur, rows: cur.rows.map((d) => (d.id === next.id ? { ...d, ...next } : d)) } : cur));
      qc.setQueryData(DELIVERY_KEY(next.id), (cur: AdminDelivery | undefined) => ({ ...cur, ...next }));
    },
    refresh: () => Promise.all([qc.invalidateQueries({ queryKey: DELIVERIES_KEY }), qc.invalidateQueries({ queryKey: ['dl'] }), qc.invalidateQueries({ queryKey: DELIVERY_ORDERS_KEY })]),
  };
}

export function useAssignDriver() {
  const cache = useDeliveryCache();
  return useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string }) => adminDeliveryApi.assignDriver(id, driverId),
    onSuccess: (d) => {
      cache.put(d);
      void cache.refresh();
    },
  });
}

/**
 * Pick up / deliver. On the stock backend only a driver account may do this, so an owner gets a 403; we remember
 * that for the session and the buttons turn into a hint instead of failing again and again.
 */
export function useStepBlocked(): { blocked: boolean; mark: () => void } {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: BLOCKED_KEY, queryFn: () => false, staleTime: Infinity, gcTime: Infinity, initialData: false });
  return { blocked: q.data === true, mark: () => qc.setQueryData(BLOCKED_KEY, true) };
}

export function useAdvance() {
  const cache = useDeliveryCache();
  const { mark } = useStepBlocked();
  return useMutation({
    mutationFn: ({ id, step }: { id: string; step: Step }) => (step === 'pickup' ? adminDeliveryApi.markPickedUp(id) : adminDeliveryApi.markDelivered(id)),
    onSuccess: (d) => {
      cache.put(d);
      void cache.refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 403) mark();
    },
  });
}

export function deliveryError(e: unknown): string {
  const err = parseError(e);
  if (err.status === 403) return 'This account isn’t allowed to do that. Ask the assigned driver to update it from the driver page.';
  if (err.status === 404) return 'That delivery or driver could not be found. Refresh and try again.';
  return err.display;
}
