'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckoutSteps } from './checkout-steps';
import { lineDetails } from './cart-line';
import { OrderDetails } from './order-details';
import { OrderSummary } from './order-summary';
import { Alert } from '@/components/ui/alert';
import { ordersApi, type OrderStatus } from '@/lib/api/orders';
import { getSnapshot, type CheckoutSnapshot } from '@/lib/checkout-session';
import { parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';

const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'REFUNDED'];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

/** The happy-path stages for each order type, in order. */
function stages(type: string): OrderStatus[] {
  return type === 'DELIVERY'
    ? ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']
    : ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
}

export function ConfirmationView({ orderId }: { orderId: string }) {
  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    // Keep the status fresh while the restaurant works on it.
    refetchInterval: (q) => (q.state.data && TERMINAL.includes(q.state.data.status) ? false : 15_000),
  });
  const tracking = useQuery({
    queryKey: ['order-track', orderId],
    queryFn: () => ordersApi.track(orderId),
    enabled: !!order.data,
    retry: false,
    refetchInterval: 30_000,
  });

  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  useEffect(() => setSnapshot(getSnapshot(orderId)), [orderId]);

  if (order.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading your order">
        <div className="sv-skel" style={{ height: 160, marginBottom: 16 }} />
        <div className="sv-cart-layout">
          <div className="sv-skel" style={{ height: 260 }} />
          <div className="sv-skel" style={{ height: 220 }} />
        </div>
      </div>
    );
  }
  if (order.isError) {
    const err = parseError(order.error);
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">🔎</div>
        <h2>{err.status === 404 ? 'We couldn’t find that order' : 'We couldn’t load your order'}</h2>
        <p>{err.display}</p>
        {err.status === 404 ? (
          <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => order.refetch()}>Try again</button>
        )}
      </div>
    );
  }

  const o = order.data;
  const cancelled = o.status === 'CANCELLED' || o.status === 'REFUNDED';
  const unpaid = o.status === 'PLACED' && o.payment_status === 'PENDING';
  const cash = o.payment_status === 'PENDING' && o.status !== 'PLACED';
  const eta = tracking.data?.estimated_completion_time;
  const flow = stages(o.order_type);
  const reached = flow.indexOf(o.status);

  const headline = cancelled
    ? 'This order was cancelled'
    : unpaid
      ? 'Almost there. Payment is still needed'
      : 'Thank you! Your order is in';
  const sub = cancelled
    ? `Order #${o.order_number} from ${o.restaurant_name} won’t be prepared.`
    : unpaid
      ? `Order #${o.order_number} is waiting for payment before ${o.restaurant_name} can start.`
      : `${o.restaurant_name} has received order #${o.order_number}.`;

  return (
    <div>
      <CheckoutSteps current={cancelled || unpaid ? 2 : 3} />

      <section className={`card sv-confirm ${cancelled ? 'bad' : unpaid ? 'warn' : 'good'}`} aria-live="polite">
        <div className="sv-confirm-icon" aria-hidden="true">{cancelled ? '✕' : unpaid ? '…' : '✓'}</div>
        <div>
          <h1>{headline}</h1>
          <p>{sub}</p>
          <div className="sv-confirm-chips">
            <span className={`badge ${cancelled ? 'badge-crit' : o.status === 'DELIVERED' ? 'badge-good' : 'badge-accent'}`}>{STATUS_LABEL[o.status]}</span>
            <span className={`badge ${o.payment_status === 'COMPLETED' ? 'badge-good' : o.payment_status === 'FAILED' ? 'badge-crit' : 'badge-warn'}`}>
              {o.payment_status === 'COMPLETED' ? 'Paid' : o.payment_status === 'REFUNDED' ? 'Refunded' : o.payment_status === 'FAILED' ? 'Payment failed' : cash ? (o.order_type === 'DELIVERY' ? 'Pay on delivery' : 'Pay at restaurant') : 'Payment pending'}
            </span>
            {!cancelled && eta && <span className="sv-eta">Estimated ready: {formatDateTime(eta)}</span>}
          </div>
          {unpaid && (
            <Link href={`/customer/checkout/payment/${orderId}`} className="btn btn-primary" style={{ marginTop: 14 }}>
              Go to payment
            </Link>
          )}
        </div>
      </section>

      {!cancelled && reached >= 0 && (
        <ol className="sv-progress" aria-label="Order progress">
          {flow.map((s, i) => (
            <li key={s} className={i < reached ? 'done' : i === reached ? 'current' : ''} aria-current={i === reached ? 'step' : undefined}>
              <span className="dot" aria-hidden="true">{i < reached ? '✓' : i + 1}</span>
              <span className="txt">{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="sv-cart-layout" style={{ marginTop: 18 }}>
        <section className="card sv-sec" aria-labelledby="oi-h">
          <h2 id="oi-h">Your order</h2>
          <OrderDetails order={o} snapshot={snapshot} />
          <ul className="sv-mini-lines" style={{ marginTop: 14 }}>
            {o.items.map((line) => (
              <li key={line.id}>
                <span className="q">{line.quantity}×</span>
                <span className="n">
                  {line.item_name}
                  {lineDetails(line).length > 0 && <small>{lineDetails(line).join(' · ')}</small>}
                  {line.special_instructions && <small>“{line.special_instructions}”</small>}
                </span>
                <span className="p">{formatMoney(line.subtotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="sv-cart-aside">
          <OrderSummary subtotal={o.subtotal} tax={o.tax_amount} deliveryFee={o.delivery_fee} total={o.total_amount} title="Payment summary" />
          <Alert kind="info">Order history and live tracking arrive in the next step. Keep this order number handy: <strong>#{o.order_number}</strong>.</Alert>
          <Link href="/customer/restaurants" className="btn btn-primary btn-block">Order something else</Link>
          {o.restaurant && (
            <Link href={`/customer/restaurants/${o.restaurant}`} className="btn btn-ghost btn-block">Back to {o.restaurant_name}</Link>
          )}
        </aside>
      </div>
    </div>
  );
}
