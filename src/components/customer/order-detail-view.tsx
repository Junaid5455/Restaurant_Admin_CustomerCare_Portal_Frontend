'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CancelOrderButton } from './cancel-order-button';
import { lineDetails } from './cart-line';
import { OrderDetails } from './order-details';
import { OrderSummary } from './order-summary';
import { ReorderButton } from './reorder-button';
import { StatusProgress } from './status-progress';
import { useTickets } from '@/hooks/use-tickets';
import { TICKET_STATUS_LABEL, ticketBadgeClass } from '@/lib/api/support';
import { ordersApi } from '@/lib/api/orders';
import { getSnapshot, type CheckoutSnapshot } from '@/lib/checkout-session';
import { parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';
import { STATUS_LABEL, canCancel, isFinished, needsPayment, paymentLabel, statusBadgeClass, statusMessage } from '@/lib/order-status';

export function OrderDetailView({ orderId }: { orderId: string }) {
  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchInterval: (q) => (q.state.data && !isFinished(q.state.data.status) ? 20_000 : false),
  });

  // Tickets already opened for this order (silent if the list can't load).
  const tickets = useTickets();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  useEffect(() => setSnapshot(getSnapshot(orderId)), [orderId]);

  const back = (
    <Link href="/customer/orders" className="sv-back">← All orders</Link>
  );

  if (order.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading order">
        {back}
        <div className="sv-skel" style={{ height: 120, margin: '14px 0' }} />
        <div className="sv-cart-layout">
          <div className="sv-skel" style={{ height: 280 }} />
          <div className="sv-skel" style={{ height: 220 }} />
        </div>
      </div>
    );
  }
  if (!order.data) {
    const err = parseError(order.error);
    return (
      <div>
        {back}
        <div className="sv-state" style={{ marginTop: 14 }}>
          <div className="emoji" aria-hidden="true">🔎</div>
          <h2>{err.status === 404 ? 'We couldn’t find that order' : 'We couldn’t load this order'}</h2>
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

  const o = order.data;
  const finished = isFinished(o.status);
  const unpaid = needsPayment(o);
  const pay = paymentLabel(o);
  const count = o.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div>
      {back}

      <section className="card sv-confirm" style={{ marginTop: 14 }}>
        <div>
          <p className="sv-eyebrow">Order #{o.order_number} · {formatDateTime(o.created_at)}</p>
          <h1>{o.restaurant ? <Link href={`/customer/restaurants/${o.restaurant}`}>{o.restaurant_name}</Link> : o.restaurant_name}</h1>
          <p>{statusMessage(o)}</p>
          <div className="sv-confirm-chips">
            <span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span>
            <span className={`badge ${pay.cls}`}>{pay.text}</span>
            <span className="sv-eta">{count} {count === 1 ? 'item' : 'items'} · {formatMoney(o.total_amount)}</span>
          </div>
        </div>
      </section>

      <div style={{ margin: '14px 0' }}>
        <StatusProgress status={o.status} type={o.order_type} />
      </div>

      <div className="sv-cart-layout">
        <section className="card sv-sec" aria-labelledby="oi-h">
          <h2 id="oi-h">Items</h2>
          <ul className="sv-mini-lines" style={{ border: 'none', padding: 0, margin: '0 0 6px' }}>
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
          <h2 style={{ marginTop: 22 }}>Order info</h2>
          <OrderDetails order={o} snapshot={snapshot} />
        </section>

        <aside className="sv-cart-aside">
          <OrderSummary subtotal={o.subtotal} tax={o.tax_amount} deliveryFee={o.delivery_fee} total={o.total_amount} title="Payment summary" />

          {unpaid && (
            <Link href={`/customer/checkout/payment/${o.id}`} className="btn btn-primary btn-block">Pay now</Link>
          )}
          {!finished && !unpaid && (
            <Link href={`/customer/orders/${o.id}/track`} className="btn btn-primary btn-block">Track order</Link>
          )}
          <ReorderButton order={o} className={`btn btn-block ${finished ? 'btn-primary' : 'btn-ghost'}`} />
          {canCancel(o.status) && <CancelOrderButton orderId={o.id} className="btn btn-ghost btn-block" />}

          <div className="sv-report">
            <Link href={`/customer/support/new?order=${o.id}`} className="btn btn-ghost btn-block">⚠️ Report a problem</Link>
            {(tickets.data?.tickets ?? []).filter((tk) => tk.related_order === o.id).length > 0 && (
              <div className="sv-report-list">
                <p className="sv-acct-note">Tickets for this order</p>
                <ul>
                  {(tickets.data?.tickets ?? []).filter((tk) => tk.related_order === o.id).slice(0, 3).map((tk) => (
                    <li key={tk.id}>
                      <Link href={`/customer/support/${tk.id}`}>
                        <span>{tk.subject}</span>
                        <span className={`badge ${ticketBadgeClass(tk.status)}`}>{TICKET_STATUS_LABEL[tk.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
