'use client';

import { useMemo, useState } from 'react';
import { AnalyticsFrame, Delta, Kpi, Note, Panel, RangeChips } from './analytics-kit';
import { Columns, TrendChart, type TrendPoint } from './analytics-charts';
import { useOverview, useSales, useStoredChoice } from '@/hooks/use-admin-analytics';
import { RANGES, compact, longDay, shortDay, summarise, windows, type Range } from '@/lib/analytics';
import { formatMoney } from '@/lib/format';

const ALLOWED = RANGES.map((r) => r.value);

export function AnalyticsSalesView() {
  const [range, setRange] = useStoredChoice<Range>('an-range', 14, ALLOWED);
  const [asTable, setAsTable] = useState(false);
  const sales = useSales();
  const overview = useOverview();

  const view = useMemo(() => {
    if (!sales.data) return null;
    const { current, previous } = windows(sales.data, range);
    return { current, previous, now: summarise(current), before: previous ? summarise(previous) : null };
  }, [sales.data, range]);

  const hasSales = !!sales.data && sales.data.some((p) => p.sales > 0 || p.orders > 0);
  const versus = `the ${range} days before`;
  const o = overview.data;

  const trend: TrendPoint[] = (view?.current ?? []).map((p, i) => ({
    label: shortDay(p.date),
    long: longDay(p.date),
    value: p.sales,
    prev: view?.previous ? view.previous[i]?.sales ?? null : undefined,
    prevLabel: view?.previous?.[i] ? shortDay(view.previous[i].date) : undefined,
  }));

  return (
    <AnalyticsFrame
      active="sales"
      title="Sales"
      description="How much your restaurant is selling, day by day."
      actions={<RangeChips<Range> label="Time range" value={range} options={RANGES} onChange={setRange} />}
    >
      <div className="ad-kpis">
        <Kpi tone="coral" icon="💰" label={`Sales, last ${range} days`} loading={sales.isPending} value={view ? formatMoney(view.now.sales) : null} sub={view ? <Delta now={view.now.sales} before={view.before?.sales ?? null} versus={view.before ? versus : 'Earlier days aren’t available to compare'} /> : null} />
        <Kpi tone="violet" icon="🧾" label="Delivered orders" loading={sales.isPending} value={view ? String(view.now.orders) : null} sub={view ? <Delta now={view.now.orders} before={view.before?.orders ?? null} versus={view.before ? versus : 'Earlier days aren’t available to compare'} /> : null} />
        <Kpi tone="teal" icon="🛒" label="Average order" loading={sales.isPending} value={view ? formatMoney(view.now.avg) : null} sub={view?.before ? <Delta now={view.now.avg} before={view.before.avg} versus={versus} /> : 'Sales divided by orders'} />
        <Kpi tone="yellow" icon="🏆" label="Best day" loading={sales.isPending} value={view?.now.best ? formatMoney(view.now.best.sales) : view ? '—' : null} sub={view?.now.best ? `${longDay(view.now.best.date)} · ${view.now.best.orders} ${view.now.best.orders === 1 ? 'order' : 'orders'}` : 'No sales in this period'} />
      </div>

      <Panel
        title="Sales per day"
        subtitle={`Delivered orders, last ${range} days${view?.previous ? ', against the days before' : ''}`}
        query={sales}
        empty={!hasSales ? (<><div className="ad-empty-icon" aria-hidden="true">📈</div><strong>No sales in the last 30 days</strong><span>Delivered orders will appear here as soon as you have some.</span></>) : undefined}
        actions={hasSales ? <button type="button" className="an-link" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? 'Show chart' : 'View as table'}</button> : undefined}
      >
        {view && !asTable && (
          <TrendChart
            points={trend}
            name="Sales"
            prevName={`The ${range} days before`}
            format={formatMoney}
            axisFormat={compact}
            label={`Sales per day for the last ${range} days. ${formatMoney(view.now.sales)} in total. Use the arrow keys to read each day.`}
          />
        )}
        {view && asTable && (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <caption className="sr-only">Sales per day</caption>
              <thead><tr><th scope="col">Day</th><th scope="col" className="num">Orders</th><th scope="col" className="num">Sales</th><th scope="col" className="num">Average</th></tr></thead>
              <tbody>
                {[...view.current].reverse().map((p) => (
                  <tr key={p.date}><th scope="row" style={{ textAlign: 'left' }}>{longDay(p.date)}</th><td className="num">{p.orders}</td><td className="num">{formatMoney(p.sales)}</td><td className="num">{p.orders ? formatMoney(p.avg) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="an-grid-2">
        <Panel title="Delivered orders per day" subtitle={`Last ${range} days`} query={sales} empty={!hasSales ? <span>No orders yet.</span> : undefined}>
          {view && (
            <Columns
              items={view.current.map((p) => ({ label: shortDay(p.date), long: longDay(p.date), value: p.orders }))}
              unit="orders"
              format={(v) => String(v)}
              axisFormat={(v) => String(v)}
              label={`Delivered orders per day for the last ${range} days`}
            />
          )}
        </Panel>

        <Panel title="Today" subtitle={o ? `${o.restaurant_name}, by your server's clock` : undefined} query={overview}>
          {o && (
            <dl className="an-today">
              <div><dt>Orders placed</dt><dd>{o.today_orders_count}</dd></div>
              <div><dt>In progress</dt><dd>{o.pending_orders}</dd></div>
              <div><dt>Delivered</dt><dd>{o.completed_orders}</dd></div>
              <div><dt>Cancelled</dt><dd>{o.cancelled_orders}</dd></div>
            </dl>
          )}
        </Panel>
      </div>

      <Note>Sales count delivered orders only, so orders still in progress, cancelled or refunded aren&apos;t included. Days follow your server&apos;s calendar, which may differ slightly from your local day.</Note>
    </AnalyticsFrame>
  );
}
