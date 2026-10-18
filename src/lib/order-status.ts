import type { OrderType } from './api/cart';
import type { Order, OrderStatus, PaymentStatus } from './api/orders';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export const TYPE_LABEL: Record<OrderType, string> = { PICKUP: 'Pickup', DELIVERY: 'Delivery', DINE_IN: 'Dine in' };

export const TYPE_ICON: Record<OrderType, string> = { PICKUP: '🥡', DELIVERY: '🛵', DINE_IN: '🍽' };

/** Statuses after which nothing more will happen to the order. */
export const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REFUNDED'];

export const isFinished = (status: OrderStatus) => TERMINAL.includes(status);

export const isCancelled = (status: OrderStatus) => status === 'CANCELLED' || status === 'REFUNDED';

/** The backend lets a customer cancel only while the order is PLACED or CONFIRMED. */
export const canCancel = (status: OrderStatus) => status === 'PLACED' || status === 'CONFIRMED';

/** Placed but never paid: the customer can still go back to the payment step. */
export const needsPayment = (o: Pick<Order, 'status' | 'payment_status'>) => o.status === 'PLACED' && o.payment_status === 'PENDING';

/** The happy-path stages for each order type, in order. */
export function stages(type: OrderType | string): OrderStatus[] {
  return type === 'DELIVERY'
    ? ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']
    : ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
}

export function statusBadgeClass(status: OrderStatus): string {
  if (isCancelled(status)) return 'badge-crit';
  if (status === 'DELIVERED') return 'badge-good';
  if (status === 'READY' || status === 'OUT_FOR_DELIVERY') return 'badge-violet';
  return 'badge-accent';
}

export function paymentLabel(o: Pick<Order, 'status' | 'payment_status' | 'order_type'>): { text: string; cls: string } {
  const map: Record<PaymentStatus, { text: string; cls: string }> = {
    COMPLETED: { text: 'Paid', cls: 'badge-good' },
    REFUNDED: { text: 'Refunded', cls: 'badge-warn' },
    FAILED: { text: 'Payment failed', cls: 'badge-crit' },
    PENDING: { text: 'Payment pending', cls: 'badge-warn' },
  };
  // Cancelled before any money moved.
  if (isCancelled(o.status) && o.payment_status === 'PENDING') return { text: 'Not charged', cls: 'badge-violet' };
  // A confirmed order whose payment is still pending was placed as cash.
  if (o.payment_status === 'PENDING' && o.status !== 'PLACED' && !isCancelled(o.status)) {
    return { text: o.order_type === 'DELIVERY' ? 'Pay on delivery' : 'Pay at restaurant', cls: 'badge-warn' };
  }
  return map[o.payment_status] ?? map.PENDING;
}

/** One friendly sentence about where the order is right now. */
export function statusMessage(o: Pick<Order, 'status' | 'payment_status' | 'order_type' | 'restaurant_name'>): string {
  const r = o.restaurant_name;
  switch (o.status) {
    case 'PLACED':
      return o.payment_status === 'PENDING' ? `Waiting for payment before ${r} can start.` : `${r} has received your order.`;
    case 'CONFIRMED':
      return `${r} confirmed your order and will start on it shortly.`;
    case 'PREPARING':
      return `${r} is preparing your food.`;
    case 'READY':
      return o.order_type === 'DELIVERY' ? 'Your order is packed and waiting for a driver.' : o.order_type === 'DINE_IN' ? 'Your food is ready and on its way to your table.' : 'Your order is ready to collect.';
    case 'OUT_FOR_DELIVERY':
      return 'Your driver has picked up your order and is on the way.';
    case 'DELIVERED':
      return o.order_type === 'DELIVERY' ? 'Delivered. Enjoy your meal!' : 'Completed. Enjoy your meal!';
    case 'CANCELLED':
      return 'This order was cancelled.';
    case 'REFUNDED':
      return 'This order was refunded.';
  }
}
