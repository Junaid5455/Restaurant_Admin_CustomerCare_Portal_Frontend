'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ListSkeleton, OrdersFrame, Pager } from './orders-kit';
import { RefundModal } from './refund-modal';
import { Button } from '@/components/ui/submit-button';
import { ADMIN_ORDERS_KEY } from '@/hooks/use-admin-orders';
import { adminOrdersApi, type AdminOrder, type AdminOrderParams } from '@/lib/api/admin-orders';
import { customerLabel, paymentMethodLabel } from '@/lib/admin-orders';
import { parseError } from '@/lib/errors';
import { formatMoney, toNumber } from '@/lib/format';
import { timeAgo } from '@/lib/time-ago';

const WAITING: AdminOrderParams = { status: 'CANCELLED', payment_status: 'COMPLETED', page_size: 50 };

function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="card ad-empty" role="alert">
      <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
      <strong>We couldn&apos;t load this</strong>
      <span>{parseError(error).display}</span>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

function Waiting({ onRefund }: { onRefund: (o: AdminOrder) => void }) {
  const q = useQuery({ queryKey: [...ADMIN_ORDERS_KEY, 'refund-waiting'], queryFn: () => adminOrdersApi.list(WAITING), refetchInterval: 30_000, retry: false });
  return (
    <section aria-labelledby="rf-wait">
      <div className="ad-rowhead" style={{ marginBottom: 10 }}>
        <h2 id="rf-wait" className="ad-section-title">Waiting for a refund {q.data && q.data.totalItems > 0 && <span className="badge badge-warn">{q.data.totalItems}</span>}</h2>
      </div>
      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <SectionError error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.orders.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">✅</div>
          <strong>Nobody is waiting for a refund</strong>
          <span>Orders you cancel after the guest paid will appear here.</span>
        </div>
      ) : (
        <div className="card">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <caption className="sr-only">Cancelled orders that were paid and still need a refund</caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Cancelled</th>
                  <th scope="col" className="num">Paid</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {q.data.orders.map((o) => (
                  <tr key={o.id}>
                    <th scope="row" className="ad-order-no" style={{ textAlign: 'left' }}>
                      <Link href={`/owner/orders/${o.id}`} className="ad-rowlink">#{o.order_number}</Link>
                    </th>
                    <td>{customerLabel(o)}</td>
                    <td className="ad-muted">{timeAgo(o.cancelled_at ?? o.created_at)}</td>
                    <td className="num">{formatMoney(o.payment?.amount ?? o.total_amount)}</td>
                    <td className="num"><Button className="ad-btn-sm" onClick={() => onRefund(o)} aria-label={`Refund order ${o.order_number}`}>Refund…</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function History({ page, onPage }: { page: number; onPage: (p: number) => void }) {
  const q = useQuery({
    queryKey: [...ADMIN_ORDERS_KEY, 'refund-history', page],
    queryFn: () => adminOrdersApi.list({ payment_status: 'REFUNDED', page, page_size: 15 }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const orders = q.data?.orders ?? [];
  const total = orders.reduce((sum, o) => sum + toNumber(o.payment?.refund_amount ?? o.total_amount), 0);
  return (
    <section aria-labelledby="rf-hist">
      <div className="ad-rowhead" style={{ marginBottom: 10 }}>
        <h2 id="rf-hist" className="ad-section-title">Refund history</h2>
        {q.data && orders.length > 0 && <span className="ad-muted">{formatMoney(total)} refunded on this page</span>}
      </div>
      {q.isPending ? (
        <ListSkeleton rows={4} />
      ) : q.isError && !q.data ? (
        <SectionError error={q.error} onRetry={() => q.refetch()} />
      ) : orders.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">🧾</div>
          <strong>No refunds yet</strong>
          <span>Refunds you issue will be listed here.</span>
        </div>
      ) : (
        <>
          <div className="card" style={{ opacity: q.isPlaceholderData ? 0.6 : 1 }}>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <caption className="sr-only">Refunded orders</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Guest</th>
                    <th scope="col">Method</th>
                    <th scope="col">Reason</th>
                    <th scope="col" className="num">Refunded</th>
                    <th scope="col" className="num">When</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const refunded = toNumber(o.payment?.refund_amount ?? o.total_amount);
                    const partial = refunded > 0 && refunded < toNumber(o.total_amount);
                    return (
                      <tr key={o.id}>
                        <th scope="row" className="ad-order-no" style={{ textAlign: 'left' }}>
                          <Link href={`/owner/orders/${o.id}`} className="ad-rowlink">#{o.order_number}</Link>
                        </th>
                        <td>{customerLabel(o)}</td>
                        <td className="ad-muted">{paymentMethodLabel(o.payment?.payment_method) || '—'}</td>
                        <td><div className="ad-items" title={o.payment?.refund_reason ?? ''}>{o.payment?.refund_reason || '—'}</div></td>
                        <td className="num">{formatMoney(refunded)} {partial && <span className="badge badge-neutral">Partial</span>}</td>
                        <td className="num ad-muted">{timeAgo(o.payment?.refunded_at ?? o.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {q.data && <Pager page={q.data.page} totalPages={q.data.totalPages} totalItems={q.data.totalItems} noun="refunds" onPage={onPage} />}
        </>
      )}
    </section>
  );
}

export function RefundsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const [target, setTarget] = useState<AdminOrder | null>(null);

  return (
    <OrdersFrame active="refunds" title="Refunds" description="Return money to guests for cancelled or problem orders, and see what you've already refunded.">
      <p className="ad-hint-block">
        To refund any other paid order, open it from <Link href="/owner/orders" className="ad-rowlink">All orders</Link> and choose Refund on its payment card.
      </p>
      <Waiting onRefund={setTarget} />
      <History page={page} onPage={(p) => router.replace(p <= 1 ? pathname : `${pathname}?page=${p}`, { scroll: false })} />
      {target && <RefundModal order={target} onClose={() => setTarget(null)} />}
    </OrdersFrame>
  );
}
