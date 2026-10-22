import type { AdminOrder } from './api/admin-orders';
import type { OrderStatus } from './api/orders';
import { isFinished } from './order-status';

/** The order a restaurant moves an order through. READY is skipped for delivery orders (they go straight out). */
export function flow(type: string): OrderStatus[] {
  return type === 'DELIVERY'
    ? ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']
    : ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
}

/** The next step the restaurant would normally take, or null when the order is finished. */
export function nextStatus(o: Pick<AdminOrder, 'status' | 'order_type'>): OrderStatus | null {
  if (isFinished(o.status)) return null;
  const f = flow(o.order_type);
  // A delivery order the kitchen marked READY still goes out for delivery next.
  if (o.status === 'READY' && o.order_type === 'DELIVERY') return 'OUT_FOR_DELIVERY';
  const i = f.indexOf(o.status);
  return i >= 0 && i < f.length - 1 ? f[i + 1] : null;
}

/** The step before this one (for correcting a mis-tap), or null at the start / when finished. */
export function previousStatus(o: Pick<AdminOrder, 'status' | 'order_type'>): OrderStatus | null {
  if (isFinished(o.status)) return null;
  if (o.status === 'READY' && o.order_type === 'DELIVERY') return 'PREPARING';
  const f = flow(o.order_type);
  const i = f.indexOf(o.status);
  return i > 0 ? f[i - 1] : null;
}

/** Button wording for the action that moves an order to `to`. */
export const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirm order',
  PREPARING: 'Start preparing',
  READY: 'Mark ready',
  OUT_FOR_DELIVERY: 'Send out for delivery',
  DELIVERED: 'Mark delivered',
};

/** The backend only allows cancelling while the order is PLACED or CONFIRMED. */
export const ownerCanCancel = (status: OrderStatus) => status === 'PLACED' || status === 'CONFIRMED';

/** Money has been taken and not yet returned, so a refund is possible. */
export const canRefund = (o: Pick<AdminOrder, 'payment_status'>) => o.payment_status === 'COMPLETED';

/** Cancelled after the customer paid: the restaurant still owes them a refund. */
export const needsRefund = (o: Pick<AdminOrder, 'status' | 'payment_status'>) => o.status === 'CANCELLED' && o.payment_status === 'COMPLETED';

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  STRIPE: 'Card (Stripe)',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  CASH_ON_DELIVERY: 'Cash on delivery',
  CASH_AT_RESTAURANT: 'Cash at restaurant',
};

export const paymentMethodLabel = (m: string | null | undefined) =>
  m ? PAYMENT_METHOD_LABEL[m] ?? m.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '';

/** Who ordered: the name if the API gives one, otherwise a short customer reference. */
export function customerLabel(o: Pick<AdminOrder, 'customer' | 'customer_name' | 'customer_email'>): string {
  return o.customer_name?.trim() || o.customer_email || `Customer ${String(o.customer).slice(0, 6)}`;
}

export function itemsSummary(o: Pick<AdminOrder, 'items'>): string {
  const items = o.items ?? [];
  if (!items.length) return 'No items';
  const first = items.slice(0, 2).map((i) => `${i.quantity}× ${i.item_name}`).join(', ');
  return items.length > 2 ? `${first} +${items.length - 2} more` : first;
}
