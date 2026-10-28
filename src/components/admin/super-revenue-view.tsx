'use client';

import { useMemo } from 'react';
import { BarList, TrendChart } from './analytics-charts';
import { Kpi, Note, Panel } from './analytics-kit';
import { PageHead } from './super-kit';
import { Button } from '@/components/ui/submit-button';
import { usePlatformOrders, usePlatformRestaurants, useSummary } from '@/hooks/use-super-admin';
import { compact, downloadCsv, stamp } from '@/lib/analytics';
import { formatMoney } from '@/lib/format';
import { isRevenue, orderAmount, orderTime, restaurantName, revenueByRestaurant, sumPerDay } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

export function SuperRevenueView() {
  const summary = useSummary();
  const orders = usePlatformOrders();
  const restaurants = usePlatformRestaurants();
  const list = useMemo(() => orders.data ?? [], [orders.data]);
  const delivered = list.filter(isRevenue);
  const sampleRevenue = delivered.reduce((a, o) => a + orderAmount(o), 0);
  const avg = delivered.length ? sampleRevenue / delivered.length : null;
  const byRest = useMemo(() => revenueByRestaurant(list, restaurants.data), [list, restaurants.data]);
  const daily = useMemo(() => sumPerDay(delivered.map((o) => ({ at: orderTime(o), amount: orderAmount(o) })), 14), [delivered]);
  const trend = daily.map((d) => ({ label: d.label, long: d.long, value: d.value }));
  const top = byRest[0];
  const lost = list.filter((o) => o.status === 'CANCELLED' || o.status === 'REFUNDED');
  const lostValue = lost.reduce((a, o) => a + orderAmount(o), 0);

  function download() {
    downloadCsv(
      [['Order', 'Restaurant', 'Customer', 'Type', 'Status', 'Total', 'Placed at'], ...list.map((o) => [o.order_number ?? o.id, restaurantName(o, restaurants.data), o.customer_email ?? '', o.order_type ?? '', o.status ?? '', orderAmount(o), orderTime(o) ?? ''])],
      `platform-orders-${stamp()}.csv`,
    );
  }

  return (
    <>
      <PageHead
        title="Revenue"
        description="What the platform has earned, and where it comes from."
        actions={<Button variant="ghost" onClick={download} disabled={list.length === 0}>⬇ Download orders (CSV)</Button>}
      />
      <div className="ad-stack">
        <div className="ad-kpis">
          <Kpi tone="coral" icon="💰" label="Total revenue" value={summary.isError ? null : summary.data ? formatMoney(summary.data.total_revenue) : null} sub="All delivered orders, ever" loading={summary.isPending} />
          <Kpi tone="violet" icon="🧾" label="Revenue, latest orders" value={orders.isError ? null : orders.data ? formatMoney(sampleRevenue) : null} sub={`${delivered.length} delivered of the latest ${list.length}`} loading={orders.isPending} />
          <Kpi tone="teal" icon="📈" label="Average order" value={orders.isError ? null : orders.data ? (avg === null ? '—' : formatMoney(avg)) : null} sub="Delivered orders in the latest list" loading={orders.isPending} />
          <Kpi tone="yellow" icon="🏆" label="Top restaurant" value={orders.isError ? null : orders.data ? (top ? top.name : '—') : null} sub={top ? `${formatMoney(top.revenue)} in the latest list` : 'No delivered orders yet'} loading={orders.isPending} />
        </div>

        <Panel title="Revenue per day" subtitle="Delivered orders in the latest list, last 14 days" query={orders} empty={delivered.length === 0 ? <span>No delivered orders in the latest list.</span> : undefined}>
          <TrendChart points={trend} name="Revenue" format={formatMoney} axisFormat={compact} label={`Revenue per day for the last 14 days from the latest orders. ${formatMoney(sampleRevenue)} in total. Use the arrow keys to read each day.`} />
        </Panel>

        <div className="su-grid-2">
          <Panel title="Revenue by restaurant" subtitle="Delivered orders in the latest list" query={orders} empty={byRest.length === 0 ? <span>No delivered orders yet.</span> : undefined}>
            <BarList label="Revenue by restaurant" items={byRest.slice(0, 8).map((r) => ({ label: r.name, value: r.revenue, text: formatMoney(r.revenue), sub: `${r.orders} ${r.orders === 1 ? 'order' : 'orders'} · ${sampleRevenue ? Math.round((r.revenue / sampleRevenue) * 100) : 0}%` }))} />
          </Panel>
          <Panel title="Latest orders" subtitle="Newest first" query={orders} empty={list.length === 0 ? <span>No orders yet.</span> : undefined}>
            <div className="ad-table-wrap">
              <table className="ad-table" style={{ minWidth: 0 }}>
                <caption className="sr-only">Latest orders</caption>
                <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col" className="num">Total</th></tr></thead>
                <tbody>
                  {list.slice(0, 10).map((o) => (
                    <tr key={o.id}>
                      <th scope="row"><div className="su-name">#{o.order_number ?? o.id.slice(0, 8)}</div><div className="su-sub">{restaurantName(o, restaurants.data)} · {timeAgo(orderTime(o))}</div></th>
                      <td>{(o.status ?? '—').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</td>
                      <td className="num">{formatMoney(orderAmount(o))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {lost.length > 0 && <Note>{lost.length} of the latest {list.length} orders were cancelled or refunded ({formatMoney(lostValue)}). They are not counted as revenue.</Note>}
        <Note>“Total revenue” is exact. Everything else here comes from the latest {list.length || 50} orders, because the platform API doesn’t return older ones, so per-restaurant and per-day figures are a recent snapshot, not all time. Platform fees and commissions aren’t tracked yet.</Note>
      </div>
    </>
  );
}
