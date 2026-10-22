'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/submit-button';
import type { AdminOrder } from '@/lib/api/admin-orders';
import { paymentLabel } from '@/lib/order-status';

/** Heading plus the "All orders / Refunds" tabs shared by the two list pages. */
export function OrdersFrame({ active, title, description, actions, children }: { active: 'orders' | 'refunds'; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <nav className="ad-tabs" aria-label="Order sections">
        <Link href="/owner/orders" className={`ad-tab ${active === 'orders' ? 'active' : ''}`} aria-current={active === 'orders' ? 'page' : undefined}>
          <span aria-hidden="true">📋</span>All orders
        </Link>
        <Link href="/owner/orders/refunds" className={`ad-tab ${active === 'refunds' ? 'active' : ''}`} aria-current={active === 'refunds' ? 'page' : undefined}>
          <span aria-hidden="true">↩️</span>Refunds
        </Link>
      </nav>
      <div className="ad-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="ad-head-actions">{actions}</div>}
      </div>
      <div className="ad-stack">{children}</div>
    </>
  );
}

export function PayBadge({ order }: { order: Pick<AdminOrder, 'status' | 'payment_status' | 'order_type'> }) {
  const p = paymentLabel(order);
  return <span className={`badge ${p.cls}`}>{p.text}</span>;
}

export function Pager({ page, totalPages, totalItems, noun = 'orders', onPage }: { page: number; totalPages: number; totalItems: number; noun?: string; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <p className="ad-pager" aria-live="polite">{totalItems} {totalItems === 1 ? noun.replace(/s$/, '') : noun}</p>;
  return (
    <nav className="ad-pager" aria-label="Pagination">
      <Button variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>← Previous</Button>
      <span aria-live="polite">Page {page} of {totalPages} · {totalItems} {noun}</span>
      <Button variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next →</Button>
    </nav>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card" aria-busy="true" aria-label="Loading orders" style={{ padding: 16 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ad-skel" style={{ height: 44, marginBottom: i === rows - 1 ? 0 : 10 }} />
      ))}
    </div>
  );
}
