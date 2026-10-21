'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useAuth } from '@/context/auth-context';
import { useDashboard } from '@/hooks/use-dashboard';
import { CATEGORY_ICON, CATEGORY_LABEL, TICKET_STATUS_LABEL, ticketBadgeClass } from '@/lib/api/support';
import type { Order, OrderStatus } from '@/lib/api/orders';
import { percentChange, type DashboardSummary } from '@/lib/dashboard-stats';
import { formatMoney } from '@/lib/format';
import { STATUS_LABEL, TYPE_ICON, TYPE_LABEL, statusBadgeClass } from '@/lib/order-status';
import { timeAgo } from '@/lib/time-ago';
import { parseError } from '@/lib/errors';

const STATUS_ORDER: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "▲ 12% vs yesterday", or a plain note when there's nothing to compare with. */
function Delta({ now, before }: { now: number; before: number }) {
  const pct = percentChange(now, before);
  if (pct === null) return <span>{now > 0 ? 'First sales to compare against yet' : 'Nothing yesterday'}</span>;
  if (pct === 0) return <span>Same as yesterday</span>;
  const up = pct > 0;
  return (
    <span>
      <span className={`ad-delta ${up ? 'up' : 'down'}`}>
        <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(pct)}%
        <span className="sr-only">{up ? ' up' : ' down'}</span>
      </span>{' '}
      vs yesterday
    </span>
  );
}

function Kpi({
  tone, icon, label, value, sub, loading,
}: {
  tone: 'violet' | 'coral' | 'teal' | 'yellow';
  icon: string;
  label: string;
  /** null = this number couldn't be loaded. */
  value: string | null;
  sub?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className={`card ad-kpi is-${tone}`} role="group" aria-label={label}>
      <div className="ad-kpi-top">
        <div className="ad-kpi-label">{label}</div>
        <div className="ad-kpi-icon" aria-hidden="true">{icon}</div>
      </div>
      {loading ? (
        <>
          <div className="ad-skel" style={{ height: 34, width: '60%' }} aria-hidden="true" />
          <div className="ad-skel" style={{ height: 14, width: '80%' }} aria-hidden="true" />
        </>
      ) : (
        <>
          <div className={`ad-kpi-value ${value === null ? 'ad-kpi-na' : ''}`}>{value ?? '—'}</div>
          <div className="ad-kpi-sub">{value === null ? "Couldn't load this" : sub}</div>
        </>
      )}
    </div>
  );
}

function itemsSummary(o: Order): string {
  const items = o.items ?? [];
  if (!items.length) return '—';
  const first = `${items[0].item_name} ×${items[0].quantity}`;
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

function RecentOrders({ summary }: { summary: DashboardSummary }) {
  if (!summary.recent.length) {
    return (
      <div className="ad-empty">
        <div className="ad-empty-icon" aria-hidden="true">🧾</div>
        <strong>No orders yet</strong>
        <span>New orders will show up here as soon as customers place them.</span>
      </div>
    );
  }
  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <caption className="sr-only">Most recent orders</caption>
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Items</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">Total</th>
            <th scope="col" className="num">Placed</th>
          </tr>
        </thead>
        <tbody>
          {summary.recent.map((o) => (
            <tr key={o.id}>
              <th scope="row" className="ad-order-no" style={{ textAlign: 'left' }}>#{o.order_number}</th>
              <td><div className="ad-items" title={itemsSummary(o)}>{itemsSummary(o)}</div></td>
              <td className="ad-muted"><span aria-hidden="true">{TYPE_ICON[o.order_type]}</span> {TYPE_LABEL[o.order_type]}</td>
              <td><span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span></td>
              <td className="num">{formatMoney(o.total_amount)}</td>
              <td className="num ad-muted">{timeAgo(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Revenue7({ summary }: { summary: DashboardSummary }) {
  const max = Math.max(1, ...summary.last7.map((d) => d.revenue));
  const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));
  return (
    <ol className="ad-bars" aria-label="Revenue for each of the last 7 days">
      {summary.last7.map((d) => (
        <li key={d.key} className={`ad-bar ${d.isToday ? 'today' : ''}`}>
          <span className="sr-only">
            {d.isToday ? 'Today' : d.label}: {formatMoney(d.revenue)} from {d.orders} {d.orders === 1 ? 'order' : 'orders'}
          </span>
          <span className="ad-bar-val" aria-hidden="true">{d.revenue > 0 ? compact(d.revenue) : ''}</span>
          <span className="ad-bar-col" aria-hidden="true" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} />
          <span className="ad-bar-label" aria-hidden="true">{d.isToday ? 'Today' : d.label}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusBreakdown({ summary }: { summary: DashboardSummary }) {
  const rows = STATUS_ORDER.map((s) => [s, summary.todayByStatus[s] ?? 0] as const).filter(([, n]) => n > 0);
  if (!rows.length) {
    return <p className="ad-note">No orders placed today yet.</p>;
  }
  const total = rows.reduce((n, [, c]) => n + c, 0);
  return (
    <div className="ad-prog">
      {rows.map(([s, n]) => (
        <div key={s}>
          <div className="ad-prog-row">
            <span>{STATUS_LABEL[s]}</span>
            <span className="ad-muted">{n} · {Math.round((n / total) * 100)}%</span>
          </div>
          <div className="ad-prog-track" role="presentation"><div className="ad-prog-fill" style={{ width: `${(n / total) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const q = useDashboard();
  const d = q.data;
  // Re-render every minute so "5m ago" keeps moving between refreshes.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const first = user?.first_name || '';
  const loading = q.isPending;
  const s = d?.summary ?? null;
  const tickets = d?.tickets ?? null;
  const updated = d ? new Date(d.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>{greeting()}{first ? `, ${first}` : ''}</h1>
          <p>{s?.restaurantName ? `${s.restaurantName} · ` : ''}Here&apos;s how today is going.</p>
        </div>
        <div className="ad-head-actions">
          {updated && <span role="status" aria-live="polite">Updated {updated}</span>}
          <Button variant="ghost" onClick={() => q.refetch()} loading={q.isFetching && !loading} loadingText="Refreshing…">
            Refresh
          </Button>
        </div>
      </div>

      {q.isError && <Alert>{parseError(q.error).display}</Alert>}

      <section className="ad-kpis" aria-label="Key numbers">
        <Kpi
          tone="teal" icon="🛍" label="Today's orders" loading={loading}
          value={s ? String(s.today.orders) : null}
          sub={s && <Delta now={s.today.orders} before={s.yesterday.orders} />}
        />
        <Kpi
          tone="coral" icon="💰" label="Today's revenue" loading={loading}
          value={s ? formatMoney(s.today.revenue) : null}
          sub={s && <Delta now={s.today.revenue} before={s.yesterday.revenue} />}
        />
        <Kpi
          tone="violet" icon="🔥" label="Active orders" loading={loading}
          value={s ? String(s.active) : null}
          sub={s && (s.awaiting > 0 ? <><strong style={{ color: 'var(--warn)' }}>{s.awaiting}</strong> waiting to be confirmed</> : 'Nothing waiting on you')}
        />
        <Kpi
          tone="yellow" icon="🎫" label="Open tickets" loading={loading}
          value={tickets ? String(tickets.length) : null}
          sub={tickets && (tickets.length ? 'Guests waiting on a reply or fix' : 'All caught up')}
        />
      </section>

      {d?.ordersError && (
        <Alert>
          Couldn&apos;t load your orders: {d.ordersError}{' '}
          <button type="button" className="ad-link" onClick={() => q.refetch()}>Try again</button>
        </Alert>
      )}

      <div className="ad-grid-main">
        <section className="card ad-card" aria-labelledby="ad-recent">
          <div className="ad-card-head">
            <h2 id="ad-recent" className="ad-card-title">Recent orders</h2>
            {s && <span className="ad-card-meta">{s.totalOrders} in total</span>}
          </div>
          {loading ? (
            <div className="ad-card-body" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="ad-skel" style={{ height: 40, marginBottom: 10 }} />)}
            </div>
          ) : s ? (
            <RecentOrders summary={s} />
          ) : (
            <div className="ad-empty"><span>Orders aren&apos;t available right now.</span></div>
          )}
        </section>

        <section className="card ad-card" aria-labelledby="ad-tickets">
          <div className="ad-card-head">
            <h2 id="ad-tickets" className="ad-card-title">Open tickets</h2>
            {tickets && <span className="ad-card-meta">{tickets.length} open</span>}
          </div>
          {loading ? (
            <div className="ad-card-body" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 3 }, (_, i) => <div key={i} className="ad-skel" style={{ height: 52, marginBottom: 10 }} />)}
            </div>
          ) : tickets === null ? (
            <div className="ad-empty"><span>Tickets aren&apos;t available right now.</span></div>
          ) : tickets.length === 0 ? (
            <div className="ad-empty">
              <div className="ad-empty-icon" aria-hidden="true">🎉</div>
              <strong>No open tickets</strong>
              <span>Nice work. New guest requests will appear here.</span>
            </div>
          ) : (
            <ul className="ad-list">
              {tickets.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <div className="ad-list-icon" aria-hidden="true">{CATEGORY_ICON[t.category]}</div>
                  <div className="ad-list-main">
                    <div className="ad-list-title" title={t.subject}>{t.subject}</div>
                    <div className="ad-list-sub">{CATEGORY_LABEL[t.category]} · {timeAgo(t.created_at)}</div>
                  </div>
                  <span className={`badge ${ticketBadgeClass(t.status)}`}>{TICKET_STATUS_LABEL[t.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="ad-grid-2">
        <section className="card ad-card" aria-labelledby="ad-rev">
          <div className="ad-card-head">
            <h2 id="ad-rev" className="ad-card-title">Revenue, last 7 days</h2>
            <span className="ad-card-meta">Excludes cancelled &amp; refunded</span>
          </div>
          <div className="ad-card-body">
            {loading ? <div className="ad-skel" style={{ height: 180 }} aria-busy="true" aria-label="Loading" /> : s ? <Revenue7 summary={s} /> : <p className="ad-note">Not available right now.</p>}
          </div>
        </section>

        <section className="card ad-card" aria-labelledby="ad-status">
          <div className="ad-card-head">
            <h2 id="ad-status" className="ad-card-title">Today&apos;s orders by status</h2>
            <span className="ad-card-meta">Today</span>
          </div>
          <div className="ad-card-body">
            {loading ? <div className="ad-skel" style={{ height: 120 }} aria-busy="true" aria-label="Loading" /> : s ? <StatusBreakdown summary={s} /> : <p className="ad-note">Not available right now.</p>}
          </div>
        </section>
      </div>

      {s && !s.complete && (
        <p className="ad-note">
          Figures are based on your latest {s.sampleSize} of {s.totalOrders} orders, so older days may look lower than they were.
        </p>
      )}
    </>
  );
}
