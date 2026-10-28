'use client';

import { AnalyticsFrame, Kpi, Note, Panel } from './analytics-kit';
import { useOverview, useTopCustomers } from '@/hooks/use-admin-analytics';
import { formatMoney } from '@/lib/format';

export function AnalyticsCustomersView() {
  const customers = useTopCustomers();
  const overview = useOverview();
  const rows = customers.data ?? [];
  const o = overview.data;
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const orders = rows.reduce((s, r) => s + r.orders, 0);
  const maxSpent = Math.max(1, ...rows.map((r) => r.spent));
  const top = rows[0];

  return (
    <AnalyticsFrame active="customers" title="Customers" description="Who orders from you, and who your best customers are.">
      <div className="ad-kpis">
        <Kpi tone="violet" icon="👥" label="Customers" loading={overview.isPending} value={o ? String(o.total_customers) : null} sub="Have placed an order" />
        <Kpi tone="coral" icon="🔁" label="Orders per customer" loading={overview.isPending} value={o ? (o.total_customers ? (o.total_orders / o.total_customers).toFixed(1) : '0') : null} sub={o ? `${o.total_orders} orders in total` : undefined} />
        <Kpi tone="teal" icon="🥇" label="Top customer" loading={customers.isPending} value={customers.data ? (top ? formatMoney(top.spent) : '—') : null} sub={top ? top.email : 'No delivered orders yet'} />
        <Kpi tone="yellow" icon="💎" label="Top ten spent" loading={customers.isPending} value={customers.data ? formatMoney(spent) : null} sub={customers.data ? `${orders} delivered ${orders === 1 ? 'order' : 'orders'}` : undefined} />
      </div>

      <Panel
        title="Your best customers"
        subtitle="Top ten by spending on delivered orders"
        query={customers}
        empty={customers.data && rows.length === 0 ? (<><div className="ad-empty-icon" aria-hidden="true">👥</div><strong>No customers yet</strong><span>Your best customers will be listed here once orders are delivered.</span></>) : undefined}
      >
        <div className="ad-table-wrap">
          <table className="ad-table">
            <caption className="sr-only">Top customers by spending</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Customer</th>
                <th scope="col" className="num">Orders</th>
                <th scope="col" className="num">Spent</th>
                <th scope="col" className="num">Average order</th>
                <th scope="col"><span className="sr-only">Share of the top spender</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="an-rank">{i + 1}</td>
                  <th scope="row" style={{ textAlign: 'left', overflowWrap: 'anywhere' }}>{r.email}</th>
                  <td className="num">{r.orders}</td>
                  <td className="num">{formatMoney(r.spent)}</td>
                  <td className="num ad-muted">{r.orders ? formatMoney(r.spent / r.orders) : '—'}</td>
                  <td style={{ width: 120 }}><div className="an-bar-track" aria-hidden="true"><span style={{ width: `${(r.spent / maxSpent) * 100}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Note>Customers are shown by email because that is all your server returns about them. The best-customers list covers delivered orders only; the customer total counts everyone who has ordered.</Note>
    </AnalyticsFrame>
  );
}
