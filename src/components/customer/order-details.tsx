import type { Order } from '@/lib/api/orders';
import type { CheckoutSnapshot } from '@/lib/checkout-session';
import { formatDateTime } from '@/lib/pickup';

export const TYPE_LABEL = { PICKUP: 'Pickup', DELIVERY: 'Delivery', DINE_IN: 'Dine in' } as const;

/** Where / when the order goes. The order API omits this, so it relies on the checkout snapshot when present. */
export function OrderDetails({ order, snapshot }: { order: Order; snapshot: CheckoutSnapshot | null }) {
  const rows: [string, string][] = [
    ['Order', `#${order.order_number}`],
    ['Restaurant', order.restaurant_name],
    ['Type', TYPE_LABEL[order.order_type] ?? order.order_type],
  ];
  if (order.order_type === 'DELIVERY' && snapshot?.address) rows.push(['Deliver to', snapshot.address]);
  if (order.order_type === 'DELIVERY' && snapshot?.deliveryInstructions) rows.push(['Instructions', snapshot.deliveryInstructions]);
  if (order.order_type === 'PICKUP' && snapshot?.pickupTime) rows.push(['Pickup', formatDateTime(snapshot.pickupTime)]);
  if (order.order_type === 'DINE_IN' && snapshot?.tableNumber) {
    rows.push(['Table', `${snapshot.tableNumber}${snapshot.guests ? ` · ${snapshot.guests} ${snapshot.guests === 1 ? 'guest' : 'guests'}` : ''}`]);
  }
  return (
    <dl className="sv-details">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
