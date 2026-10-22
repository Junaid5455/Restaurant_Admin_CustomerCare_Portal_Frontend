import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminOrdersApi, type AdminOrder } from '@/lib/api/admin-orders';
import type { OrderStatus } from '@/lib/api/orders';
import { DASHBOARD_KEY } from './use-dashboard';

export const ADMIN_ORDER_KEY = (id: string) => ['admin-order', id] as const;
export const ADMIN_ORDERS_KEY = ['admin-orders'] as const;

/** One order, kept fresh while it is still moving. */
export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ADMIN_ORDER_KEY(id),
    queryFn: () => adminOrdersApi.get(id),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && s !== 'DELIVERED' && s !== 'CANCELLED' && s !== 'REFUNDED' ? 30_000 : false;
    },
  });
}

/** After any change, refresh the order, every list and the dashboard KPIs. */
export function useRefreshOrders() {
  const qc = useQueryClient();
  return async (id?: string) => {
    await Promise.all([
      id ? qc.invalidateQueries({ queryKey: ADMIN_ORDER_KEY(id) }) : Promise.resolve(),
      qc.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY }),
      qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
    ]);
  };
}

export function useUpdateStatus() {
  const refresh = useRefreshOrders();
  return useMutation({
    mutationFn: ({ order, status }: { order: AdminOrder; status: OrderStatus }) => adminOrdersApi.updateStatus(order.id, status),
    onSettled: (_d, _e, v) => refresh(v.order.id),
  });
}

export function useCancelOrder() {
  const refresh = useRefreshOrders();
  return useMutation({
    mutationFn: ({ order, reason }: { order: AdminOrder; reason: string }) => adminOrdersApi.cancel(order.id, reason),
    onSettled: (_d, _e, v) => refresh(v.order.id),
  });
}

export function useRefund() {
  const refresh = useRefreshOrders();
  return useMutation({
    mutationFn: ({ paymentId, amount, reason }: { order: AdminOrder; paymentId: string; amount: number; reason: string }) =>
      adminOrdersApi.refund(paymentId, amount, reason),
    onSettled: (_d, _e, v) => refresh(v.order.id),
  });
}
