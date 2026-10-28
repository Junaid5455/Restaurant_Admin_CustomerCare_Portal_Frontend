'use client';

import { useMemo } from 'react';
import { BarList, Columns } from './analytics-charts';
import { Kpi, Note, Panel } from './analytics-kit';
import { PageHead } from './super-kit';
import { useAllTickets, usePlatformOrders, usePlatformRestaurants, usePlatformUsers } from '@/hooks/use-super-admin';
import { compact } from '@/lib/analytics';
import { CATEGORY_LABEL, TICKET_STATUS_LABEL } from '@/lib/api/support';
import { ROLE_NAME, perDay, ratingOf, tally, ticketStats } from '@/lib/super-admin';

const bars = (rows: { key: string; count: number }[], name: (k: string) => string, total: number) =>
  rows.map((r) => ({ label: name(r.key), value: r.count, text: String(r.count), sub: total ? `${Math.round((r.count / total) * 100)}%` : undefined }));

export function SuperAnalyticsView() {
  const users = usePlatformUsers();
  const restaurants = usePlatformRestaurants();
  const orders = usePlatformOrders();
  const tickets = useAllTickets();

  const growth = useMemo(() => perDay((users.data ?? []).filter((u) => u.role === 'CUSTOMER').map((u) => u.date_joined), 30), [users.data]);
  const joined30 = growth.reduce((a, p) => a + p.value, 0);
  const roles = useMemo(() => tally(users.data ?? [], (u) => u.role), [users.data]);
  const cities = useMemo(() => tally(restaurants.data ?? [], (r) => r.city).slice(0, 6), [restaurants.data]);
  const ratings = useMemo(() => {
    const bins = [0, 0, 0, 0, 0];
    for (const r of restaurants.data ?? []) {
      const n = ratingOf(r);
      if (n) bins[Math.min(5, Math.max(1, Math.round(n))) - 1] += 1;
    }
    return bins.map((v, i) => ({ label: `${i + 1}★`, value: v, long: `Rounds to ${i + 1} ${i === 0 ? 'star' : 'stars'}` }));
  }, [restaurants.data]);
  const rated = ratings.reduce((a, b) => a + b.value, 0);
  const avgRating = useMemo(() => {
    const all = (restaurants.data ?? []).map(ratingOf).filter((n): n is number => n !== null);
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
  }, [restaurants.data]);
  const byStatus = useMemo(() => tally(orders.data ?? [], (o) => o.status), [orders.data]);
  const byType = useMemo(() => tally(orders.data ?? [], (o) => o.order_type), [orders.data]);
  const t = useMemo(() => ticketStats(tickets.data?.tickets ?? []), [tickets.data]);
  const nOrders = orders.data?.length ?? 0;
  const nTickets = tickets.data?.tickets.length ?? 0;
  const nRest = restaurants.data?.length ?? 0;
  const activeRest = (restaurants.data ?? []).filter((r) => r.is_active).length;

  return (
    <>
      <PageHead title="Platform analytics" description="Growth, restaurants, orders and support across everyone." />
      <div className="ad-stack">
        <div className="ad-kpis">
          <Kpi tone="teal" icon="🆕" label="New customers, 30 days" value={users.data ? String(joined30) : null} sub="Joined in the last 30 days" loading={users.isPending} />
          <Kpi tone="violet" icon="🏪" label="Restaurants live" value={restaurants.data ? `${activeRest} / ${nRest}` : null} sub="Active out of all" loading={restaurants.isPending} />
          <Kpi tone="yellow" icon="⭐" label="Average rating" value={restaurants.data ? (avgRating ? avgRating.toFixed(1) : '—') : null} sub={rated ? `Across ${rated} rated restaurants` : 'No ratings yet'} loading={restaurants.isPending} />
          <Kpi tone="coral" icon="🎫" label="Open tickets" value={tickets.data ? String(t.open) : null} sub={t.urgentOpen ? `${t.urgentOpen} high or urgent` : 'None high or urgent'} loading={tickets.isPending} />
        </div>

        <Panel title="Customer growth" subtitle="New customers per day, last 30 days" query={users} empty={users.data && users.data.length === 0 ? <span>No customers yet.</span> : undefined}>
          <Columns items={growth} format={(v) => `${v} new`} axisFormat={compact} unit="new customers" labelEvery={5} label={`New customers per day for the last 30 days. ${joined30} in total.`} />
        </Panel>

        <div className="su-grid-2">
          <Panel title="Who is on the platform" subtitle={users.data ? `${users.data.length} accounts` : undefined} query={users} empty={roles.length === 0 ? <span>No accounts yet.</span> : undefined}>
            <BarList label="Accounts by role" items={bars(roles, (k) => ROLE_NAME[k] ?? k, users.data?.length ?? 0)} />
          </Panel>
          <Panel title="Restaurants by city" subtitle="Top six" query={restaurants} empty={cities.length === 0 ? <span>No city information.</span> : undefined}>
            <BarList label="Restaurants by city" items={bars(cities, (k) => k, nRest)} />
          </Panel>
        </div>

        <div className="su-grid-2">
          <Panel title="Restaurant ratings" subtitle="Restaurants by rating, rounded to the nearest star" query={restaurants} empty={rated === 0 ? <span>No restaurant has a rating yet.</span> : undefined}>
            <Columns items={ratings} format={(v) => `${v} restaurants`} axisFormat={(v) => String(Math.round(v))} unit="restaurants" height={180} label="Restaurants by star rating" />
          </Panel>
          <Panel title="Support tickets" subtitle={tickets.data ? `${nTickets} in total` : undefined} query={tickets} empty={nTickets === 0 ? <span>No tickets yet.</span> : undefined}>
            <BarList label="Tickets by status" items={bars(t.byStatus, (k) => TICKET_STATUS_LABEL[k as keyof typeof TICKET_STATUS_LABEL] ?? k, nTickets)} />
          </Panel>
        </div>

        <div className="su-grid-2">
          <Panel title="What people complain about" subtitle="Tickets by category" query={tickets} empty={nTickets === 0 ? <span>No tickets yet.</span> : undefined}>
            <BarList label="Tickets by category" items={bars(t.byCategory, (k) => CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k, nTickets)} />
          </Panel>
          <Panel title="Orders by status" subtitle={`Latest ${nOrders} orders`} query={orders} empty={nOrders === 0 ? <span>No orders yet.</span> : undefined}>
            <BarList label="Orders by status" items={bars(byStatus, (k) => k.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), nOrders)} />
            {byType.length > 0 && <Note>{byType.map((x) => `${x.key.replace(/_/g, ' ').toLowerCase()}: ${x.count}`).join(' · ')}</Note>}
          </Panel>
        </div>

        <Note>The platform API only returns the latest 50 orders, so the order figures describe those orders, not all time. Tickets cover up to your latest 500.</Note>
      </div>
    </>
  );
}
