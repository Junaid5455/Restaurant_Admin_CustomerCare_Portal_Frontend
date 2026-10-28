'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Columns } from './analytics-charts';
import { Kpi, Panel } from './analytics-kit';
import { ActiveBadge, PageHead, dateOnly } from './super-kit';
import { useAllTickets, usePlatformOrders, usePlatformRestaurants, usePlatformUsers, useSummary } from '@/hooks/use-super-admin';
import { compact } from '@/lib/analytics';
import { TICKET_STATUS_LABEL } from '@/lib/api/support';
import { formatMoney } from '@/lib/format';
import { byAttention, isOpenTicket, orderAmount, orderTime, perDay, PRIORITY_LABEL, priorityBadge, restaurantName } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

export function SuperOverviewView() {
  const summary = useSummary();
  const users = usePlatformUsers();
  const restaurants = usePlatformRestaurants();
  const orders = usePlatformOrders();
  const tickets = useAllTickets();
  const s = summary.data;

  const signups = useMemo(() => perDay((users.data ?? []).filter((u) => u.role === 'CUSTOMER').map((u) => u.date_joined), 14), [users.data]);
  const attention = useMemo(() => (tickets.data?.tickets ?? []).filter(isOpenTicket).sort(byAttention).slice(0, 5), [tickets.data]);
  const newest = useMemo(() => [...(restaurants.data ?? [])].sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '')).slice(0, 5), [restaurants.data]);
  const recent = (orders.data ?? []).slice(0, 6);
  const pending = summary.isPending;
  const failed = summary.isError;
  const totalRestaurants = restaurants.data?.length;

  return (
    <>
      <PageHead title="Platform overview" description="How the whole platform is doing, right now." />
      <div className="ad-stack">
        <div className="su-kpis">
          <Kpi tone="coral" icon="💰" label="Revenue" value={failed ? null : s ? formatMoney(s.total_revenue) : null} sub="Delivered orders, all restaurants" loading={pending} />
          <Kpi tone="violet" icon="🧾" label="Orders" value={failed ? null : s ? s.total_orders.toLocaleString('en-US') : null} sub="Every order, any status" loading={pending} />
          <Kpi tone="teal" icon="🏪" label="Active restaurants" value={failed ? null : s ? String(s.active_restaurants) : null} sub={totalRestaurants !== undefined ? `Out of ${totalRestaurants}` : 'On the platform'} loading={pending} />
          <Kpi tone="yellow" icon="👥" label="Customers" value={failed ? null : s ? s.total_customers.toLocaleString('en-US') : null} sub="Signed-up customers" loading={pending} />
          <Kpi tone="coral" icon="🎫" label="Open tickets" value={failed ? null : s ? String(s.open_support_tickets) : null} sub="Open or in progress" loading={pending} />
        </div>

        <div className="su-grid-2">
          <Panel title="New customers" subtitle="Joined per day, last 14 days" query={users} empty={users.data && users.data.length === 0 ? <span>No customers yet.</span> : undefined}>
            <Columns items={signups} format={(v) => `${v} new`} axisFormat={compact} unit="new customers" label={`New customers per day for the last 14 days. ${signups.reduce((a, p) => a + p.value, 0)} in total.`} labelEvery={2} />
          </Panel>

          <Panel title="Needs attention" subtitle="Open tickets, urgent and oldest first" query={tickets} empty={attention.length === 0 ? <span>No open tickets. Nice.</span> : undefined} actions={<Link className="an-link" href="/admin/support">All tickets</Link>}>
            <ul className="su-list">
              {attention.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/support/${t.id}`}>
                    <strong>{t.subject}</strong>
                    <div className="su-sub">{t.ticket_id} · {t.customer_email} · {timeAgo(t.created_at)}</div>
                  </Link>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge ${priorityBadge(t.priority)}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                    <span className="badge badge-neutral">{TICKET_STATUS_LABEL[t.status]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="su-grid-2">
          <Panel title="Newest restaurants" query={restaurants} empty={newest.length === 0 ? <span>No restaurants yet.</span> : undefined} actions={<Link className="an-link" href="/admin/restaurants">Manage</Link>}>
            <ul className="su-list">
              {newest.map((r) => (
                <li key={r.id}>
                  <span><strong>{r.name}</strong><div className="su-sub">{[r.city, dateOnly(r.created_at)].filter((x) => x && x !== '—').join(' · ')}</div></span>
                  <ActiveBadge active={r.is_active} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Latest orders" subtitle="Across all restaurants" query={orders} empty={recent.length === 0 ? <span>No orders yet.</span> : undefined} actions={<Link className="an-link" href="/admin/revenue">Revenue</Link>}>
            <ul className="su-list">
              {recent.map((o) => (
                <li key={o.id}>
                  <span><strong>#{o.order_number ?? o.id.slice(0, 8)}</strong><div className="su-sub">{restaurantName(o, restaurants.data)} · {timeAgo(orderTime(o))}</div></span>
                  <span style={{ textAlign: 'right' }}>{formatMoney(orderAmount(o))}<div className="su-sub">{o.status ?? ''}</div></span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
