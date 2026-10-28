'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnalyticsFrame, Note, Panel, RangeChips } from './analytics-kit';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { useOverview, usePopular, useSales, useStoredChoice } from '@/hooks/use-admin-analytics';
import { adminAnalyticsApi, ALL_STATUSES, ALL_TYPES } from '@/lib/api/admin-analytics';
import { SAMPLE_RANGES, downloadBlob, downloadCsv, guard, lastDays, longDay, productStats, stamp, summarise, within } from '@/lib/analytics';
import { parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/order-status';

const ALLOWED = SAMPLE_RANGES.map((r) => r.value);

export function AnalyticsReportsView() {
  const qc = useQueryClient();
  const { push } = useToast();
  const [range, setRange] = useStoredChoice<number>('an-prange', 30, ALLOWED);
  const [busy, setBusy] = useState<string | null>(null);
  const overview = useOverview();
  const sales = useSales();
  const popular = usePopular();

  const fetchFresh = <T,>(key: string, fn: () => Promise<T>) => qc.fetchQuery({ queryKey: [key], queryFn: fn, staleTime: 60_000 });

  async function run(id: string, job: () => Promise<string>) {
    setBusy(id);
    try {
      push(await job());
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setBusy(null);
    }
  }

  const rangeLabel = SAMPLE_RANGES.find((r) => r.value === range)?.label ?? '';
  const rangeSlug = range === 0 ? 'all-loaded' : `${range}d`;

  const reports: { id: string; icon: string; title: string; text: string; file: string; job: () => Promise<string> }[] = [
    {
      id: 'orders', icon: '🧾', title: 'Orders, last 30 days', file: 'CSV',
      text: 'One line per order: number, customer, status, type, total and time. This is the report your server builds.',
      job: async () => { const f = await adminAnalyticsApi.exportSales(); downloadBlob(f.blob, f.filename); return `Saved ${f.filename}`; },
    },
    {
      id: 'daily', icon: '📈', title: 'Daily sales, last 30 days', file: 'CSV',
      text: 'Delivered orders, sales and average order for each day.',
      job: async () => {
        const pts = lastDays(await fetchFresh('an-sales', adminAnalyticsApi.sales), 30);
        downloadCsv([['Day', 'Delivered orders', 'Sales', 'Average order'], ...pts.map((p) => [p.date, p.orders, p.sales.toFixed(2), p.orders ? p.avg.toFixed(2) : ''])], `daily-sales-${stamp()}.csv`);
        return 'Saved the daily sales report';
      },
    },
    {
      id: 'dishes', icon: '🍽', title: `Dish performance, ${rangeLabel.toLowerCase()}`, file: 'CSV',
      text: 'Units sold, sales and number of orders for each dish. Uses the range chosen above.',
      job: async () => {
        const s = await fetchFresh('an-sample', () => adminAnalyticsApi.sample());
        const rows = productStats(within(s.orders, range)).sort((a, b) => b.quantity - a.quantity);
        downloadCsv([['Dish', 'Units sold', 'Sales', 'In orders'], ...rows.map((r) => [guard(r.name), r.quantity, r.revenue.toFixed(2), r.orders])], `dishes-${rangeSlug}-${stamp()}.csv`);
        return s.complete ? 'Saved the dish report' : `Saved the dish report (from your latest ${s.orders.length} orders)`;
      },
    },
    {
      id: 'customers', icon: '👥', title: 'Best customers', file: 'CSV',
      text: 'Your top ten customers by spending, with their orders and average order.',
      job: async () => {
        const rows = await fetchFresh('an-customers', adminAnalyticsApi.customers);
        downloadCsv([['Customer', 'Orders', 'Spent', 'Average order'], ...rows.map((r) => [guard(r.email), r.orders, r.spent.toFixed(2), r.orders ? (r.spent / r.orders).toFixed(2) : ''])], `best-customers-${stamp()}.csv`);
        return 'Saved the customer report';
      },
    },
    {
      id: 'mix', icon: '📋', title: 'Orders by status and type', file: 'CSV',
      text: 'How many orders are in each status and of each type.',
      job: async () => {
        const c = await fetchFresh('an-counts', adminAnalyticsApi.counts);
        downloadCsv([['Group', 'Name', 'Orders'], ...ALL_STATUSES.map((s) => ['Status', STATUS_LABEL[s], c.status[s]]), ...ALL_TYPES.map((t) => ['Type', TYPE_LABEL[t], c.type[t]])], `order-mix-${stamp()}.csv`);
        return 'Saved the order summary';
      },
    },
  ];

  const pts = sales.data ? lastDays(sales.data, 30) : [];
  const s30 = summarise(pts);
  const o = overview.data;

  return (
    <AnalyticsFrame
      active="reports"
      title="Reports"
      description="Download your numbers, or print a summary."
      actions={<Button variant="ghost" onClick={() => window.print()}>Print or save as PDF</Button>}
    >
      <div className="an-toolbar an-noprint">
        <span className="ad-muted">Dish report range</span>
        <RangeChips<number> label="Dish report range" value={range} options={SAMPLE_RANGES} onChange={setRange} />
      </div>

      <div className="an-reports an-noprint">
        {reports.map((r) => (
          <section key={r.id} className="card ad-card-pad an-report" aria-label={r.title}>
            <div className="ad-kpi-icon" aria-hidden="true" style={{ width: 38, height: 38 }}>{r.icon}</div>
            <h2 className="ad-card-title">{r.title}</h2>
            <p>{r.text}</p>
            <Button variant="ghost" loading={busy === r.id} loadingText="Preparing…" disabled={busy !== null} onClick={() => run(r.id, r.job)}>
              ⬇ Download {r.file}
            </Button>
          </section>
        ))}
      </div>

      <Panel title="Summary" subtitle={`${o?.restaurant_name ?? 'Your restaurant'} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`} query={sales.isPending || sales.isError ? sales : overview.isPending || overview.isError ? overview : undefined}>
        {o && (
          <>
            <dl className="an-today an-summary">
              <div><dt>Orders, all time</dt><dd>{o.total_orders}</dd></div>
              <div><dt>Customers</dt><dd>{o.total_customers}</dd></div>
              <div><dt>Sales, last 30 days</dt><dd>{formatMoney(s30.sales)}</dd></div>
              <div><dt>Delivered orders, last 30 days</dt><dd>{s30.orders}</dd></div>
              <div><dt>Average order</dt><dd>{formatMoney(s30.avg)}</dd></div>
              <div><dt>Best day</dt><dd>{s30.best ? `${formatMoney(s30.best.sales)}` : '—'}</dd></div>
            </dl>
            {popular.data && popular.data.length > 0 && (
              <>
                <h3 className="ad-card-title" style={{ marginTop: 18 }}>Top dishes of all time</h3>
                <ol className="an-plain">
                  {popular.data.map((p) => (
                    <li key={p.id}>{p.name} <span className="ad-muted">· {p.quantity} sold · {formatMoney(p.revenue)}</span></li>
                  ))}
                </ol>
              </>
            )}
            <h3 className="ad-card-title" style={{ marginTop: 18 }}>Sales by day</h3>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <caption className="sr-only">Sales by day for the last 30 days</caption>
                <thead><tr><th scope="col">Day</th><th scope="col" className="num">Orders</th><th scope="col" className="num">Sales</th></tr></thead>
                <tbody>
                  {[...pts].reverse().filter((p) => p.orders > 0 || p.sales > 0).map((p) => (
                    <tr key={p.date}><th scope="row" style={{ textAlign: 'left' }}>{longDay(p.date)}</th><td className="num">{p.orders}</td><td className="num">{formatMoney(p.sales)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <Note>CSV files open in Excel and Google Sheets. To save the summary as a PDF, choose Print and pick &ldquo;Save as PDF&rdquo; as the printer. Sales figures count delivered orders only.</Note>
    </AnalyticsFrame>
  );
}
