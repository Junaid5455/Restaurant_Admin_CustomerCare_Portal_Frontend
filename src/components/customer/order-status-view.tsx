'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { StatusProgress } from './status-progress';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { ordersApi, type Order } from '@/lib/api/orders';
import { formatMoney } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';
import { parseError } from '@/lib/errors';
import { STATUS_LABEL, TYPE_ICON, TYPE_LABEL, isCancelled, isFinished, needsPayment, statusBadgeClass, statusMessage } from '@/lib/order-status';

function LiveOrder({ o }: { o: Order }) {
  const unpaid = needsPayment(o);
  return (
    <article className="card sv-order" aria-label={`Order ${o.order_number} from ${o.restaurant_name}`}>
      <div className="sv-order-top">
        <div className="sv-order-id">
          <h2><Link href={`/customer/orders/${o.id}`}>{o.restaurant_name}</Link></h2>
          <p>#{o.order_number} · {formatDateTime(o.created_at)} · {TYPE_ICON[o.order_type]} {TYPE_LABEL[o.order_type]} · {formatMoney(o.total_amount)}</p>
        </div>
        <div className="sv-order-badges"><span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span></div>
      </div>
      <p className="sv-order-items" style={{ fontWeight: 600 }}>{statusMessage(o)}</p>
      <StatusProgress status={o.status} type={o.order_type} />
      <div className="sv-order-actions" style={{ marginTop: 12 }}>
        {unpaid && <Link href={`/customer/checkout/payment/${o.id}`} className="btn btn-primary">Pay now</Link>}
        <Link href={`/customer/orders/${o.id}/track`} className={unpaid ? 'btn btn-ghost' : 'btn btn-primary'}>Full tracking</Link>
        <Link href={`/customer/orders/${o.id}`} className="btn btn-ghost">Details</Link>
      </div>
    </article>
  );
}

export function OrderStatusView() {
  const q = useQuery({
    queryKey: ['orders', 'status-board'],
    queryFn: () => ordersApi.list({ page: 1, page_size: 50 }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const error = q.error ? parseError(q.error) : null;
  const all = q.data?.orders ?? [];
  const live = all.filter((o) => !isFinished(o.status));
  const recent = all.filter((o) => isFinished(o.status)).slice(0, 3);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 800 }}>Order status</h1>
        <p style={{ opacity: 0.75 }}>Where your food is right now: cooking, ready, on the way or delivered. Updates every few seconds.</p>
      </div>

      {error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <Alert>{error.display}</Alert>
          <Button variant="ghost" onClick={() => q.refetch()}>Try again</Button>
        </div>
      ) : q.isPending ? (
        <div className="sv-skel" aria-busy="true" aria-label="Loading order status" style={{ height: 180, borderRadius: 20 }} />
      ) : (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>In progress ({live.length})</h2>
          {live.length === 0 ? (
            <div className="sv-state">
              <div className="emoji" aria-hidden="true">🍽</div>
              <h2>No orders in progress</h2>
              <p>When you place an order, you can follow it here from kitchen to doorstep.</p>
              <Link href="/customer/restaurants" className="btn btn-primary">Order something</Link>
            </div>
          ) : (
            <div className="sv-orders">{live.map((o) => <LiveOrder key={o.id} o={o} />)}</div>
          )}

          {recent.length > 0 && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Recently finished</h2>
              <div className="sv-orders">
                {recent.map((o) => (
                  <article key={o.id} className="card sv-order">
                    <div className="sv-order-top">
                      <div className="sv-order-id">
                        <h2><Link href={`/customer/orders/${o.id}`}>{o.restaurant_name}</Link></h2>
                        <p>#{o.order_number} · {formatDateTime(o.created_at)}</p>
                      </div>
                      <div className="sv-order-badges"><span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span></div>
                    </div>
                    <p className="sv-order-items">{statusMessage(o)}</p>
                    {o.status === 'DELIVERED' && !isCancelled(o.status) && <div className="sv-order-actions"><Link href="/customer/reviews" className="btn btn-ghost">Rate this order</Link></div>}
                  </article>
                ))}
              </div>
            </>
          )}
          <div><Link href="/customer/orders" className="btn btn-ghost">All my orders</Link></div>
        </>
      )}
    </div>
  );
}
