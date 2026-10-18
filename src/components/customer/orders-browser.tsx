'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { OrderCard, OrderCardSkeleton } from './order-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { ordersApi, type OrderStatus } from '@/lib/api/orders';
import type { OrderType } from '@/lib/api/cart';
import { STATUS_LABEL, TYPE_LABEL, isFinished } from '@/lib/order-status';
import { parseError } from '@/lib/errors';

const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];
const TYPES = Object.keys(TYPE_LABEL) as OrderType[];
const PAGE_SIZE = 10;

export function OrdersBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const statusParam = params.get('status');
  const typeParam = params.get('type');
  const status = STATUSES.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : undefined;
  const type = TYPES.includes(typeParam as OrderType) ? (typeParam as OrderType) : undefined;
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  // Two quick changes (e.g. status then type) must build on each other, not on the not-yet-updated URL.
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
    queryKey: ['orders', { status, type, page }],
    queryFn: () => ordersApi.list({ page, page_size: PAGE_SIZE, status, order_type: type }),
    placeholderData: keepPreviousData,
    // Orders in progress change status; keep the list honest while any are showing.
    refetchInterval: (q) => (q.state.data?.orders.some((o) => !isFinished(o.status)) ? 30_000 : false),
  });

  const data = query.data;
  const error = query.error ? parseError(query.error) : null;
  const filtersActive = !!status || !!type;

  // A stale ?page= beyond the last page is a 404: fall back to page 1.
  useEffect(() => {
    if (error?.status === 404 && page > 1) update({ page: null }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.status, page]);

  function goToPage(next: number) {
    update({ page: next <= 1 ? null : String(next) }, true);
    document.querySelector('.sv-content')?.scrollTo({ top: 0 });
  }

  return (
    <>
      <div className="sv-page-head">
        <h1>My orders</h1>
        <p>Track what’s on its way, revisit past orders, or order your favourites again.</p>
      </div>

      <div className="sv-filterbar" role="group" aria-label="Filters">
        <label className="sv-filter">
          Status
          <select className="sv-select" value={status ?? ''} onChange={(e) => update({ status: e.target.value || null })}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="sv-filter">
          Type
          <select className="sv-select" value={type ?? ''} onChange={(e) => update({ type: e.target.value || null })}>
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        {filtersActive && (
          <button type="button" className="link" onClick={() => router.replace(pathname, { scroll: false })}>
            Clear filters
          </button>
        )}
      </div>

      <div className="sv-results-line" aria-live="polite">
        {data && !error && (
          <span>
            {data.totalItems} {data.totalItems === 1 ? 'order' : 'orders'}
          </span>
        )}
      </div>

      {error && !(error.status === 404 && page > 1) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <Alert>{error.display}</Alert>
          <Button variant="ghost" onClick={() => query.refetch()}>Try again</Button>
        </div>
      ) : query.isPending ? (
        <div className="sv-orders" aria-busy="true" aria-label="Loading your orders">
          {Array.from({ length: 4 }, (_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.orders.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">🧾</div>
          <h2>{filtersActive ? 'No orders match your filters' : 'No orders yet'}</h2>
          <p>{filtersActive ? 'Try a different status or order type.' : 'When you place an order, it will show up here so you can track it and order it again.'}</p>
          {filtersActive ? (
            <Button variant="ghost" onClick={() => router.replace(pathname, { scroll: false })}>Clear filters</Button>
          ) : (
            <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
          )}
        </div>
      ) : data ? (
        <>
          <div className={`sv-orders ${query.isPlaceholderData ? 'dim' : ''}`}>
            {data.orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <nav className="sv-pager" aria-label="Pagination">
              <Button variant="ghost" disabled={page <= 1} onClick={() => goToPage(page - 1)}>← Previous</Button>
              <span>Page {data.page} of {data.totalPages}</span>
              <Button variant="ghost" disabled={page >= data.totalPages} onClick={() => goToPage(page + 1)}>Next →</Button>
            </nav>
          )}
        </>
      ) : null}
    </>
  );
}
