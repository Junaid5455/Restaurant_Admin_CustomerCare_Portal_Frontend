import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kitchenApi, type KitchenOrder } from '@/lib/api/kitchen';
import type { ApiError } from '@/lib/errors';
import { parseError } from '@/lib/errors';

export const KITCHEN_KEY = ['kitchen-orders'] as const;
export const POLL_MS = 5000;

/**
 * The live board. The backend has no push channel, so this polls every 5 seconds, including while the tab is in the
 * background (a kitchen screen is often not the focused window), and again the moment the connection returns.
 */
export function useKitchenOrders() {
  return useQuery({
    queryKey: KITCHEN_KEY,
    queryFn: kitchenApi.list,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    retry: false,
  });
}

/** Start / ready with an instant update on screen, rolled back if the server says no. */
export function useKitchenActions() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const mark = (id: string, on: boolean) =>
    setPending((s) => {
      const n = new Set(s);
      on ? n.add(id) : n.delete(id);
      return n;
    });

  const run = useCallback(
    async (order: KitchenOrder, action: 'start' | 'ready'): Promise<{ ok: true } | { ok: false; error: ApiError }> => {
      mark(order.id, true);
      await qc.cancelQueries({ queryKey: KITCHEN_KEY });
      const before = qc.getQueryData<KitchenOrder[]>(KITCHEN_KEY);
      qc.setQueryData<KitchenOrder[]>(KITCHEN_KEY, (rows) =>
        action === 'ready'
          ? rows?.filter((o) => o.id !== order.id)
          : rows?.map((o) => (o.id === order.id ? { ...o, status: 'PREPARING' as const } : o)),
      );
      try {
        await (action === 'start' ? kitchenApi.start(order.id) : kitchenApi.ready(order.id));
        return { ok: true };
      } catch (e) {
        qc.setQueryData(KITCHEN_KEY, before);
        // The ticket may have moved on elsewhere (cancelled, or finished on another screen): always resync.
        void qc.invalidateQueries({ queryKey: KITCHEN_KEY });
        return { ok: false, error: parseError(e) };
      } finally {
        mark(order.id, false);
      }
    },
    [qc],
  );

  return { run, pending };
}
