'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AnalyticsFrame, Kpi, Note, Panel, RangeChips } from './analytics-kit';
import { BarList } from './analytics-charts';
import { useMenu } from '@/hooks/use-admin-menu';
import { useOrderSample, usePopular, useStoredChoice } from '@/hooks/use-admin-analytics';
import { SAMPLE_RANGES, productStats, unsoldDishes, within } from '@/lib/analytics';
import { formatMoney } from '@/lib/format';

const ALLOWED = SAMPLE_RANGES.map((r) => r.value);
type Sort = 'quantity' | 'revenue';
const SHOWN = 15;

export function AnalyticsProductsView() {
  const [range, setRange] = useStoredChoice<number>('an-prange', 30, ALLOWED);
  const [sort, setSort] = useState<Sort>('quantity');
  const [all, setAll] = useState(false);
  const sample = useOrderSample();
  const popular = usePopular();
  const menu = useMenu();

  const data = useMemo(() => {
    if (!sample.data) return null;
    const orders = within(sample.data.orders, range);
    const rows = productStats(orders).sort((a, b) => (sort === 'quantity' ? b.quantity - a.quantity || b.revenue - a.revenue : b.revenue - a.revenue || b.quantity - a.quantity));
    const units = rows.reduce((s, r) => s + r.quantity, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const oldest = sample.data.orders.length ? Date.parse(sample.data.orders[sample.data.orders.length - 1].created_at) : Date.now();
    // The loaded orders might not reach back as far as the chosen range.
    const partial = !sample.data.complete && (range === 0 || oldest > Date.now() - range * 86_400_000);
    return { orders, rows, units, revenue, partial };
  }, [sample.data, range, sort]);

  const unsold = useMemo(() => (data && menu.data ? unsoldDishes(menu.data.items, data.orders) : []), [data, menu.data]);
  const shown = data ? (all ? data.rows : data.rows.slice(0, SHOWN)) : [];
  const maxUnits = data ? Math.max(1, ...data.rows.map((r) => r.quantity)) : 1;
  const best = data?.rows[0];
  const scope = sample.data ? (sample.data.complete ? 'all your orders' : `your latest ${sample.data.orders.length} orders`) : '';

  return (
    <AnalyticsFrame
      active="products"
      title="Products"
      description="Which dishes sell, and which don't."
      actions={<RangeChips<number> label="Time range" value={range} options={SAMPLE_RANGES} onChange={setRange} />}
    >
      <div className="ad-kpis">
        <Kpi tone="coral" icon="🍽" label="Dishes ordered" loading={sample.isPending} value={data ? String(data.rows.length) : null} sub={data ? `${data.orders.length} ${data.orders.length === 1 ? 'order' : 'orders'} in this period` : undefined} />
        <Kpi tone="violet" icon="🥘" label="Units sold" loading={sample.isPending} value={data ? String(data.units) : null} sub="Cancelled and refunded excluded" />
        <Kpi tone="teal" icon="💰" label="Dish sales" loading={sample.isPending} value={data ? formatMoney(data.revenue) : null} sub="Before tax and fees" />
        <Kpi tone="yellow" icon="🏆" label="Best seller" loading={sample.isPending} value={data ? (best ? best.name : '—') : null} sub={best ? `${best.quantity} sold · ${formatMoney(best.revenue)}` : 'Nothing sold in this period'} />
      </div>

      <Panel
        title="Dish performance"
        subtitle={sample.data ? `From ${scope}` : undefined}
        query={sample}
        empty={data && data.rows.length === 0 ? (<><div className="ad-empty-icon" aria-hidden="true">🍽</div><strong>No dishes sold in this period</strong><span>Try a longer range, or come back once orders arrive.</span></>) : undefined}
        actions={<RangeChips<Sort> label="Sort by" value={sort} options={[{ value: 'quantity', label: 'Units' }, { value: 'revenue', label: 'Sales' }] as const} onChange={setSort} />}
      >
        {data && (
          <>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <caption className="sr-only">Dishes ranked by {sort === 'quantity' ? 'units sold' : 'sales'}</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Dish</th>
                    <th scope="col" className="num">Units</th>
                    <th scope="col" className="num">Sales</th>
                    <th scope="col" className="num">In orders</th>
                    <th scope="col"><span className="sr-only">Share of units</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={r.key}>
                      <td className="an-rank">{i + 1}</td>
                      <th scope="row" style={{ textAlign: 'left' }}>
                        {r.menuItemId ? <Link href={`/owner/menu/items/${r.menuItemId}`} className="ad-rowlink">{r.name}</Link> : r.name}
                      </th>
                      <td className="num">{r.quantity}</td>
                      <td className="num">{formatMoney(r.revenue)}</td>
                      <td className="num ad-muted">{r.orders}</td>
                      <td style={{ width: 120 }}><div className="an-bar-track" aria-hidden="true"><span style={{ width: `${(r.quantity / maxUnits) * 100}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.rows.length > SHOWN && (
              <button type="button" className="an-link" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${data.rows.length} dishes`}</button>
            )}
          </>
        )}
      </Panel>

      <div className="an-grid-2">
        <Panel title="Top five of all time" subtitle="Straight from your server" query={popular} empty={popular.data && popular.data.length === 0 ? <span>No sales yet.</span> : undefined}>
          {popular.data && (
            <BarList
              label="Top five dishes of all time"
              items={popular.data.map((p) => ({ label: p.name, value: p.quantity, text: `${p.quantity} sold`, sub: formatMoney(p.revenue) }))}
            />
          )}
        </Panel>

        <Panel title="Not ordered in this period" subtitle="Dishes on your menu with no orders" query={menu.isPending && !menu.data ? menu : undefined} empty={data && menu.data && unsold.length === 0 ? <span>Every dish on your menu was ordered at least once.</span> : undefined}>
          {data && menu.data && (
            <>
              <ul className="an-plain">
                {unsold.slice(0, 12).map((m) => (
                  <li key={m.id}>
                    <Link href={`/owner/menu/items/${m.id}`} className="ad-rowlink">{m.name}</Link>
                    {!m.is_available && <span className="badge badge-neutral">Unavailable</span>}
                  </li>
                ))}
              </ul>
              {unsold.length > 12 && <p className="an-note">and {unsold.length - 12} more</p>}
              {data.partial && <p className="an-note">We only loaded {scope}, so a dish whose orders are older could be listed here.</p>}
            </>
          )}
        </Panel>
      </div>

      <Note>Dish figures are worked out from {scope || 'your recent orders'} and leave out cancelled and refunded orders. The all-time top five comes from your server and counts every order.</Note>
    </AnalyticsFrame>
  );
}
