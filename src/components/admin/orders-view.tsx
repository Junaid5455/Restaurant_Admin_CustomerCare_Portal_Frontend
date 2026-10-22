'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ListSkeleton, OrdersFrame, PayBadge, Pager } from './orders-kit';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { ADMIN_ORDERS_KEY, useUpdateStatus } from '@/hooks/use-admin-orders';
import { useNow } from '@/hooks/use-now';
import { adminOrdersApi, type AdminOrder } from '@/lib/api/admin-orders';
import type { OrderType } from '@/lib/api/cart';
import type { OrderStatus, PaymentStatus } from '@/lib/api/orders';
import { ACTION_LABEL, customerLabel, itemsSummary, nextStatus } from '@/lib/admin-orders';
import { parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { STATUS_LABEL, TYPE_ICON, TYPE_LABEL, statusBadgeClass } from '@/lib/order-status';
import { timeAgo } from '@/lib/time-ago';

const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];
const TYPES = Object.keys(TYPE_LABEL) as OrderType[];
const PAYMENTS: { id: PaymentStatus; label: string }[] = [
  { id: 'PENDING', label: 'Payment pending' },
  { id: 'COMPLETED', label: 'Paid' },
  { id: 'FAILED', label: 'Payment failed' },
  { id: 'REFUNDED', label: 'Refunded' },
];
const PAGE_SIZE = 15;

/** Advances one order to its next stage straight from the list. */
function QuickAction({ order }: { order: AdminOrder }) {
  const { push } = useToast();
  const update = useUpdateStatus();
  const next = nextStatus(order);
  if (!next) return null;
  const label = ACTION_LABEL[next] ?? STATUS_LABEL[next];
  return (
    <Button
      className="ad-btn-sm"
      loading={update.isPending}
      loadingText="…"
      aria-label={`${label} for order ${order.order_number}`}
      onClick={() =>
        update.mutate(
          { order, status: next },
          {
            onSuccess: () => push(`Order #${order.order_number}: ${STATUS_LABEL[next].toLowerCase()}`),
            onError: (e) => push(parseError(e).display, 'error'),
          },
        )
      }
    >
      {label}
    </Button>
  );
}

export function OrdersView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow(15_000);
  const [search, setSearch] = useState('');

  const statusParam = params.get('status');
  const typeParam = params.get('type');
  const payParam = params.get('pay');
  const status = STATUSES.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : undefined;
  const type = TYPES.includes(typeParam as OrderType) ? (typeParam as OrderType) : undefined;
  const pay = PAYMENTS.some((p) => p.id === payParam) ? (payParam as PaymentStatus) : undefined;
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  // Two quick changes must build on each other, not on the not-yet-updated URL.
  const pending = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [params]);

  function update(changes: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams((pending.current ?? params).toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!keepPage) next.delete('page');
    pending.current = next;
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const query = useQuery({
    queryKey: [...ADMIN_ORDERS_KEY, 'list', { status, type, pay, page }],
    queryFn: () => adminOrdersApi.list({ page, page_size: PAGE_SIZE, status, order_type: type, payment_status: pay }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const data = query.data;
  const error = query.error ? parseError(query.error) : null;
  const filtersActive = !!status || !!type || !!pay;

  // A stale ?page= beyond the last page is a 404: fall back to page 1.
  useEffect(() => {
    if (error?.status === 404 && page > 1) update({ page: null }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.status, page]);

  // The API has no search parameter, so this narrows the page that is already loaded.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.orders;
    return data.orders.filter((o) => `${o.order_number} ${customerLabel(o)} ${itemsSummary(o)}`.toLowerCase().includes(q));
  }, [data, search]);

  function goToPage(next: number) {
    update({ page: next <= 1 ? null : String(next) }, true);
    document.querySelector('.ad-content, main')?.scrollTo?.({ top: 0 });
  }

  const updatedAgo = query.dataUpdatedAt ? timeAgo(query.dataUpdatedAt, now) : '';

  return (
    <OrdersFrame
      active="orders"
      title="Orders"
      description="Everything your guests have ordered. Move orders along as you prepare them."
      actions={
        <>
          {updatedAgo && <span aria-live="off">Updated {updatedAgo}</span>}
          <Button variant="ghost" onClick={() => query.refetch()} loading={query.isFetching && !query.isPending} loadingText="Refreshing…">
            Refresh
          </Button>
        </>
      }
    >
      <div className="ad-chips" role="group" aria-label="Filter by status">
        <button type="button" className={`ad-chip ${!status ? 'active' : ''}`} aria-pressed={!status} onClick={() => update({ status: null })}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`ad-chip ${status === s ? 'active' : ''}`} aria-pressed={status === s} onClick={() => update({ status: status === s ? null : s })}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="ad-filterbar" role="group" aria-label="More filters">
        <label className="ad-filter">
          Type
          <select className="ad-select" value={type ?? ''} onChange={(e) => update({ type: e.target.value || null })}>
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="ad-filter">
          Payment
          <select className="ad-select" value={pay ?? ''} onChange={(e) => update({ pay: e.target.value || null })}>
            <option value="">Any payment</option>
            {PAYMENTS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="ad-filter ad-grow">
          Find on this page
          <input className="ad-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number, guest or dish" />
        </label>
        {filtersActive && (
          <button type="button" className="ad-link" onClick={() => update({ status: null, type: null, pay: null })}>
            Clear filters
          </button>
        )}
      </div>

      {query.isPending ? (
        <ListSkeleton />
      ) : error && !data ? (
        <div className="card ad-empty" role="alert">
          <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
          <strong>We couldn&apos;t load your orders</strong>
          <span>{error.display}</span>
          <Button onClick={() => query.refetch()}>Try again</Button>
        </div>
      ) : data && data.orders.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">📭</div>
          <strong>{filtersActive ? 'No orders match these filters' : 'No orders yet'}</strong>
          <span>{filtersActive ? 'Try a different status or clear the filters.' : 'New orders will show up here as guests place them.'}</span>
          {filtersActive && (
            <Button variant="ghost" onClick={() => update({ status: null, type: null, pay: null })}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {error && (
            <p className="ad-warn" role="status">
              Couldn&apos;t refresh just now, so this list may be out of date.
            </p>
          )}
          <div className="card" style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
            {rows.length === 0 ? (
              <div className="ad-empty">
                <strong>Nothing on this page matches “{search.trim()}”</strong>
                <span>The search only covers the orders shown here. Use the filters or other pages to look further.</span>
              </div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table ad-orders-table">
                  <caption className="sr-only">Orders</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Guest</th>
                      <th scope="col">Items</th>
                      <th scope="col">Type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Payment</th>
                      <th scope="col" className="num">Total</th>
                      <th scope="col" className="num">Placed</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <th scope="row" className="ad-order-no" style={{ textAlign: 'left' }}>
                          <Link href={`/owner/orders/${o.id}`} className="ad-rowlink">#{o.order_number}</Link>
                        </th>
                        <td>{customerLabel(o)}</td>
                        <td><div className="ad-items" title={itemsSummary(o)}>{itemsSummary(o)}</div></td>
                        <td className="ad-muted"><span aria-hidden="true">{TYPE_ICON[o.order_type]}</span> {TYPE_LABEL[o.order_type]}</td>
                        <td><span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span></td>
                        <td><PayBadge order={o} /></td>
                        <td className="num">{formatMoney(o.total_amount)}</td>
                        <td className="num ad-muted">{timeAgo(o.created_at, now)}</td>
                        <td className="num"><QuickAction order={o} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} onPage={goToPage} />}
        </>
      )}
    </OrdersFrame>
  );
}
