'use client';

import { AnalyticsFrame, Kpi, Note, Panel, RangeChips } from './analytics-kit';
import { BarList, Columns } from './analytics-charts';
import { useOrderCounts, useOrderSample, useOverview, usePeakHours, useSales, useStoredChoice } from '@/hooks/use-admin-analytics';
import { ALL_STATUSES, ALL_TYPES } from '@/lib/api/admin-analytics';
import { RANGES, WEEKDAYS, byWeekday, hourLabel, longDay, peakHoursLocal, shortDay, type Range, lastDays } from '@/lib/analytics';
import { STATUS_LABEL, TYPE_ICON, TYPE_LABEL } from '@/lib/order-status';

const ALLOWED = RANGES.map((r) => r.value);
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '0%');

export function AnalyticsOrdersView() {
  const [range, setRange] = useStoredChoice<Range>('an-range', 14, ALLOWED);
  const counts = useOrderCounts();
  const overview = useOverview();
  const sales = useSales();
  const peak = usePeakHours();
  const sample = useOrderSample();

  const c = counts.data;
  const total = c ? ALL_STATUSES.reduce((s, k) => s + c.status[k], 0) : 0;
  const cancelled = c ? c.status.CANCELLED : 0;
  const delivered = c ? c.status.DELIVERED : 0;
  const days = sales.data ? lastDays(sales.data, range) : [];
  const peaks = peak.data ? peakHoursLocal(peak.data) : [];
  const weekday = sample.data ? byWeekday(sample.data.orders) : [];

  return (
    <AnalyticsFrame
      active="orders"
      title="Orders"
      description="What kinds of orders come in, and when."
      actions={<RangeChips<Range> label="Time range" value={range} options={RANGES} onChange={setRange} />}
    >
      <div className="ad-kpis">
        <Kpi tone="violet" icon="📋" label="All orders" loading={counts.isPending} value={c ? String(total) : null} sub="Since you started" />
        <Kpi tone="coral" icon="📅" label="Placed today" loading={overview.isPending} value={overview.data ? String(overview.data.today_orders_count) : null} sub={overview.data ? `${overview.data.pending_orders} still in progress` : undefined} />
        <Kpi tone="teal" icon="✅" label="Delivered" loading={counts.isPending} value={c ? pct(delivered, total) : null} sub={c ? `${delivered} of ${total} orders` : undefined} />
        <Kpi tone="yellow" icon="🚫" label="Cancelled" loading={counts.isPending} value={c ? pct(cancelled, total) : null} sub={c ? `${cancelled} ${cancelled === 1 ? 'order' : 'orders'}` : undefined} />
      </div>

      <div className="an-grid-2">
        <Panel title="Orders by status" subtitle="Every order so far" query={counts} empty={c && total === 0 ? <span>No orders yet.</span> : undefined}>
          {c && (
            <BarList
              label="Orders by status"
              items={ALL_STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: c.status[s], text: `${c.status[s]} · ${pct(c.status[s], total)}` }))}
            />
          )}
        </Panel>
        <Panel title="Orders by type" subtitle="Every order so far" query={counts} empty={c && total === 0 ? <span>No orders yet.</span> : undefined}>
          {c && (
            <BarList
              label="Orders by type"
              items={ALL_TYPES.map((t) => ({ label: `${TYPE_ICON[t]} ${TYPE_LABEL[t]}`, value: c.type[t], text: `${c.type[t]} · ${pct(c.type[t], total)}` }))}
            />
          )}
        </Panel>
      </div>

      <Panel title="Delivered orders per day" subtitle={`Last ${range} days`} query={sales}>
        {sales.data && (
          <Columns
            items={days.map((p) => ({ label: shortDay(p.date), long: longDay(p.date), value: p.orders }))}
            unit="orders"
            format={(v) => String(v)}
            axisFormat={(v) => String(v)}
            label={`Delivered orders per day for the last ${range} days`}
          />
        )}
      </Panel>

      <div className="an-grid-2">
        <Panel title="Busiest hours" subtitle="Top five hours over the last 30 days, in your time" query={peak} empty={peak.data && peak.data.length === 0 ? <span>No orders in the last 30 days.</span> : undefined}>
          {peak.data && (
            <BarList
              label="Busiest hours"
              items={peaks.map((p) => ({ label: `${hourLabel(p.hour)} to ${hourLabel((p.hour + 1) % 24)}`, value: p.orders, text: `${p.orders} ${p.orders === 1 ? 'order' : 'orders'}` }))}
            />
          )}
        </Panel>
        <Panel
          title="Orders by day of the week"
          subtitle={sample.data ? (sample.data.complete ? 'All your orders' : `Your latest ${sample.data.orders.length} orders`) : undefined}
          query={sample}
          empty={sample.data && sample.data.orders.length === 0 ? <span>No orders yet.</span> : undefined}
        >
          {sample.data && (
            <Columns
              items={WEEKDAYS.map((d, i) => ({ label: d, value: weekday[i] }))}
              unit="orders"
              labelEvery={1}
              format={(v) => String(v)}
              axisFormat={(v) => String(v)}
              label="Orders by day of the week"
            />
          )}
        </Panel>
      </div>

      <Note>Status and type counts are exact. The delivered-per-day chart counts delivered orders only. Busiest hours are shifted from your server&apos;s clock into the time zone of this device.</Note>
    </AnalyticsFrame>
  );
}
