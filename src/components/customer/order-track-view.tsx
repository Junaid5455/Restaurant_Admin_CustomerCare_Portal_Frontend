'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CancelOrderButton } from './cancel-order-button';
import { lineDetails } from './cart-line';
import { OrderDetails } from './order-details';
import { OrderSummary } from './order-summary';
import { ReorderButton } from './reorder-button';
import { StatusProgress } from './status-progress';
import { useToast } from '@/components/ui/toast';
import { useNow } from '@/hooks/use-now';
import { deliveryApi, type Delivery } from '@/lib/api/delivery';
import { ordersApi } from '@/lib/api/orders';
import { getSnapshot, type CheckoutSnapshot } from '@/lib/checkout-session';
import { parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';
import { STATUS_LABEL, TYPE_ICON, canCancel, isCancelled, isFinished, needsPayment, statusBadgeClass, statusMessage } from '@/lib/order-status';

const ORDER_POLL_MS = 10_000;

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function etaText(etaMs: number, now: number): { big: string; small: string } {
  const mins = Math.round((etaMs - now) / 60_000);
  if (mins > 1) return { big: `~${mins} min`, small: `Expected around ${formatDateTime(new Date(etaMs).toISOString())}` };
  if (mins >= -2) return { big: 'Any moment', small: 'It should be with you very soon' };
  return { big: 'A little late', small: 'The restaurant is working on it' };
}

function DeliveryCard({ delivery, now }: { delivery: Delivery | null | undefined; now: number }) {
  const onTheWay = delivery?.status === 'PICKED_UP' || delivery?.status === 'IN_TRANSIT';
  const hasPin = !!delivery?.current_latitude && !!delivery?.current_longitude;
  const seen = delivery?.last_location_update ? now - new Date(delivery.last_location_update).getTime() : null;

  let title = 'Driver';
  let text = 'A driver will be assigned once your food is nearly ready.';
  if (delivery?.status === 'ASSIGNED') { title = 'Driver assigned'; text = 'Your driver is heading to the restaurant to pick up your order.'; }
  else if (onTheWay) { title = 'On the way'; text = 'Your driver has your order and is heading to you.'; }
  else if (delivery?.status === 'DELIVERED') { title = 'Delivered'; text = 'Your order has been handed over.'; }
  else if (delivery?.status === 'CANCELLED') { title = 'Delivery cancelled'; text = 'This delivery was cancelled.'; }

  return (
    <section className="card sv-sec" aria-labelledby="dv-h">
      <h2 id="dv-h"><span aria-hidden="true">🛵</span> {title}</h2>
      <p style={{ margin: 0, color: 'var(--fg-2)' }}>{text}</p>
      {delivery?.estimated_delivery_time_minutes ? (
        <p className="field-hint" style={{ marginTop: 8 }}>Usually about {delivery.estimated_delivery_time_minutes} minutes from pickup.</p>
      ) : null}
      {onTheWay && hasPin && (
        <p style={{ margin: '12px 0 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            className="btn btn-ghost"
            href={`https://www.google.com/maps?q=${delivery.current_latitude},${delivery.current_longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            📍 See driver on map
          </a>
          {seen !== null && <span className="field-hint">Location updated {ago(seen)}</span>}
        </p>
      )}
    </section>
  );
}

export function OrderTrackView({ orderId }: { orderId: string }) {
  const { push } = useToast();
  const now = useNow(1000);

  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: (q) => (q.state.data && isFinished(q.state.data.status) ? false : ORDER_POLL_MS),
  });
  const o = order.data;
  const active = !!o && !isFinished(o.status);

  const tracking = useQuery({
    queryKey: ['order-track', orderId],
    queryFn: () => ordersApi.track(orderId),
    enabled: !!o,
    retry: false,
    refetchInterval: active ? 30_000 : false,
  });
  const delivery = useQuery({
    queryKey: ['delivery', orderId],
    queryFn: () => deliveryApi.forOrder(orderId),
    enabled: !!o && o.order_type === 'DELIVERY' && active,
    retry: false,
    refetchInterval: 15_000,
  });

  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  useEffect(() => setSnapshot(getSnapshot(orderId)), [orderId]);

  // Tell the customer when the status moves, even if they're looking elsewhere on the page.
  const lastStatus = useRef<string | null>(null);
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    if (!o) return;
    if (lastStatus.current && lastStatus.current !== o.status) {
      const text = `${STATUS_LABEL[o.status]}: ${statusMessage(o)}`;
      setAnnounce(text);
      push(text, isCancelled(o.status) ? 'error' : 'info');
    }
    lastStatus.current = o.status;
  }, [o, push]);

  const back = <Link href="/customer/orders" className="sv-back">← All orders</Link>;

  if (order.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading order tracking">
        {back}
        <div className="sv-skel" style={{ height: 150, margin: '14px 0' }} />
        <div className="sv-cart-layout">
          <div className="sv-skel" style={{ height: 240 }} />
          <div className="sv-skel" style={{ height: 200 }} />
        </div>
      </div>
    );
  }
  if (!o) {
    const err = parseError(order.error);
    return (
      <div>
        {back}
        <div className="sv-state" style={{ marginTop: 14 }}>
          <div className="emoji" aria-hidden="true">🔎</div>
          <h2>{err.status === 404 ? 'We couldn’t find that order' : 'We couldn’t load tracking'}</h2>
          <p>{err.display}</p>
          {err.status === 404 ? (
            <Link href="/customer/orders" className="btn btn-primary">Back to my orders</Link>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => order.refetch()}>Try again</button>
          )}
        </div>
      </div>
    );
  }

  const finished = isFinished(o.status);
  const unpaid = needsPayment(o);
  const etaMs = tracking.data?.estimated_completion_time ? new Date(tracking.data.estimated_completion_time).getTime() : null;
  const eta = active && !unpaid && etaMs && !Number.isNaN(etaMs) ? etaText(etaMs, now) : null;
  const updatedAgo = order.dataUpdatedAt ? ago(now - order.dataUpdatedAt) : '';

  return (
    <div>
      {back}

      <section className={`card sv-track-hero ${isCancelled(o.status) ? 'bad' : finished ? 'good' : ''}`} style={{ marginTop: 14 }}>
        <div className="sv-track-main">
          <p className="sv-eyebrow">Order #{o.order_number} · {o.restaurant_name}</p>
          <h1>
            <span aria-hidden="true">{TYPE_ICON[o.order_type]}</span> {STATUS_LABEL[o.status]}
          </h1>
          <p>{statusMessage(o)}</p>
          <div className="sv-confirm-chips">
            <span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span>
            {active && (
              <span className="sv-live" role="status">
                <span className="pulse" aria-hidden="true" /> Live · updated {updatedAgo || 'just now'}
              </span>
            )}
          </div>
          {unpaid && (
            <Link href={`/customer/checkout/payment/${o.id}`} className="btn btn-primary" style={{ marginTop: 14 }}>
              Go to payment
            </Link>
          )}
        </div>
        {eta && (
          <div className="sv-track-eta" aria-label="Estimated time">
            <span className="label">{o.order_type === 'DELIVERY' ? 'Arriving in' : 'Ready in'}</span>
            <span className="big">{eta.big}</span>
            <span className="small">{eta.small}</span>
          </div>
        )}
      </section>

      {/* Screen readers hear status changes without the toast having to be focused. */}
      <p className="sr-only" aria-live="polite">{announce}</p>

      <div style={{ margin: '14px 0' }}>
        <StatusProgress status={o.status} type={o.order_type} />
      </div>

      <div className="sv-cart-layout">
        <div className="sv-checkout-main">
          {o.order_type === 'DELIVERY' && active && !unpaid && <DeliveryCard delivery={delivery.data} now={now} />}

          <section className="card sv-sec" aria-labelledby="ti-h">
            <h2 id="ti-h">Your order</h2>
            <OrderDetails order={o} snapshot={snapshot} />
            <ul className="sv-mini-lines" style={{ border: 'none', padding: 0, margin: 0 }}>
              {o.items.map((line) => (
                <li key={line.id}>
                  <span className="q">{line.quantity}×</span>
                  <span className="n">
                    {line.item_name}
                    {lineDetails(line).length > 0 && <small>{lineDetails(line).join(' · ')}</small>}
                  </span>
                  <span className="p">{formatMoney(line.subtotal)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="sv-cart-aside">
          <OrderSummary subtotal={o.subtotal} tax={o.tax_amount} deliveryFee={o.delivery_fee} total={o.total_amount} title="Payment summary" />
          <Link href={`/customer/orders/${o.id}`} className="btn btn-ghost btn-block">View order details</Link>
          {finished && <ReorderButton order={o} className="btn btn-primary btn-block" />}
          {canCancel(o.status) && <CancelOrderButton orderId={o.id} className="btn btn-ghost btn-block" />}
        </aside>
      </div>
    </div>
  );
}
