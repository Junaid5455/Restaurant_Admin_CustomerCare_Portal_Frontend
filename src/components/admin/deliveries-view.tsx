'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Kpi } from './analytics-kit';
import { AssignModal, DeliveryFrame, EtaTag, StatusBadge, StepButton } from './deliveries-kit';
import { Button } from '@/components/ui/submit-button';
import { useDeliveries, useDeliveryOrders } from '@/hooks/use-admin-delivery';
import { useStaff } from '@/hooks/use-admin-staff';
import { useNow } from '@/hooks/use-now';
import type { AdminDelivery } from '@/lib/api/admin-delivery';
import { BUCKETS, dueAt, driverLabel, hasPin, inBucket, isFinished, isOnTheRoad, minutesLate, needsDriver, pinIsStale, type Bucket } from '@/lib/delivery';
import { parseError } from '@/lib/errors';
import { STATUS_LABEL, isFinished as orderFinished } from '@/lib/order-status';
import { timeAgo } from '@/lib/time-ago';

const SHOW = 24;

function sortRows(rows: AdminDelivery[]): AdminDelivery[] {
  const rank = (d: AdminDelivery) => (needsDriver(d) ? 0 : !isFinished(d.status) ? 1 : 2);
  return [...rows].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra < 2) return (dueAt(a) ?? Infinity) - (dueAt(b) ?? Infinity);
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

function Card({ d, now, staffRows, onAssign }: { d: AdminDelivery; now: number; staffRows?: Parameters<typeof driverLabel>[1]; onAssign: (d: AdminDelivery) => void }) {
  const late = (minutesLate(d, now) ?? 0) > 0;
  const canAssign = !isFinished(d.status) && !isOnTheRoad(d.status);
  const pin = isOnTheRoad(d.status) && hasPin(d);
  return (
    <article className={`card dl-card ${late ? 'is-late' : ''}`} aria-label={`Delivery for order ${d.order_number}`}>
      <div className="dl-card-top">
        <div>
          <Link className="dl-order" href={`/owner/deliveries/${d.id}`}>#{d.order_number}</Link>
          <div className="dl-sub">{d.customer_email ?? 'Customer'} · {timeAgo(d.created_at, now)}</div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <StatusBadge status={needsDriver(d) ? 'PENDING' : d.status} />
          <EtaTag d={d} now={now} />
        </div>
      </div>

      <div className="dl-addr"><span aria-hidden="true">📍</span><span>{d.delivery_address || 'No address on this order'}</span></div>

      <div className={`dl-driverrow ${d.driver ? '' : 'none'}`}>
        <span aria-hidden="true">🛵</span>
        <span className="grow">{d.driver ? driverLabel(d, staffRows, d.driver) : 'No driver yet'}</span>
        {canAssign && (
          <Button variant="ghost" className="ad-btn-sm" onClick={() => onAssign(d)}>
            {d.driver ? 'Change' : 'Assign driver'}
          </Button>
        )}
      </div>

      {isOnTheRoad(d.status) && (
        <div className={`dl-pinline ${pin && pinIsStale(d, now) ? 'stale' : ''}`}>
          {pin ? <>📡 Location {d.last_location_update ? timeAgo(d.last_location_update, now) : 'received'}{pinIsStale(d, now) ? ' — may be out of date' : ''}</> : <>📡 The driver isn’t sharing a location yet</>}
        </div>
      )}

      <div className="dl-card-actions">
        <StepButton delivery={d} small />
        <Link className="ad-btn-sm btn btn-ghost push" href={`/owner/deliveries/${d.id}`}>Details →</Link>
      </div>
    </article>
  );
}

export function DeliveriesView() {
  const q = useDeliveries();
  const orders = useDeliveryOrders();
  const staff = useStaff();
  const now = useNow(30_000);
  const [bucket, setBucket] = useState<Bucket>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(SHOW);
  const [assigning, setAssigning] = useState<string | null>(null);

  const rows = useMemo(() => sortRows(q.data?.rows ?? []), [q.data]);
  const counts = useMemo(() => Object.fromEntries(BUCKETS.map((b) => [b.id, rows.filter((d) => inBucket(d, b.id)).length])) as Record<Bucket, number>, [rows]);
  const activeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of rows) if (d.driver && !isFinished(d.status)) m[d.driver] = (m[d.driver] ?? 0) + 1;
    return m;
  }, [rows]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((d) => inBucket(d, bucket) && (!s || [d.order_number, d.customer_email, d.delivery_address, d.driver_name, driverLabel(d, staff.data, d.driver)].some((v) => v?.toLowerCase().includes(s))));
  }, [rows, bucket, search, staff.data]);

  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const today = rows.filter((d) => d.status === 'DELIVERED' && d.delivered_at && Date.parse(d.delivered_at) >= startOfDay.getTime());
  const timed = today.filter((d) => d.actual_delivery_time_minutes != null);
  const avg = timed.length ? Math.round(timed.reduce((a, d) => a + (d.actual_delivery_time_minutes ?? 0), 0) / timed.length) : null;

  const known = new Set(rows.map((d) => d.order));
  const awaiting = (orders.data?.orders ?? []).filter((o) => !orderFinished(o.status) && !known.has(o.id));
  const assignTarget = rows.find((d) => d.id === assigning) ?? null;
  const loading = q.isPending;

  return (
    <DeliveryFrame
      active="list"
      title="Deliveries"
      description="Who is bringing what, and where it is right now."
      actions={<span aria-live="polite">{q.isFetching && !q.isPending ? 'Updating…' : q.dataUpdatedAt ? `Updated ${timeAgo(q.dataUpdatedAt, now) || 'just now'}` : ''}</span>}
    >
      <div className="dl-kpis">
        <Kpi tone="yellow" icon="🧑‍✈️" label="Need a driver" value={q.isError ? null : String(rows.filter(needsDriver).length)} sub="Waiting to be assigned" loading={loading} />
        <Kpi tone="violet" icon="🛵" label="On the road" value={q.isError ? null : String(rows.filter((d) => isOnTheRoad(d.status)).length)} sub="Picked up, not yet delivered" loading={loading} />
        <Kpi tone="teal" icon="✅" label="Delivered today" value={q.isError ? null : String(today.length)} sub="Since midnight" loading={loading} />
        <Kpi tone="coral" icon="⏱" label="Average time today" value={q.isError ? null : avg === null ? '—' : `${avg} min`} sub={avg === null ? 'No timed deliveries yet' : `Across ${timed.length} ${timed.length === 1 ? 'delivery' : 'deliveries'}`} loading={loading} />
      </div>

      {q.isError ? (
        <div className="card ad-empty" role="alert">
          <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
          <strong>We couldn&apos;t load deliveries</strong>
          <span>{parseError(q.error).display}</span>
          <Button onClick={() => void q.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="dl-toolbar">
            <div className="ad-chips" role="group" aria-label="Show">
              {BUCKETS.map((b) => (
                <button key={b.id} type="button" className={`ad-chip ${bucket === b.id ? 'active' : ''}`} aria-pressed={bucket === b.id} onClick={() => { setBucket(b.id); setLimit(SHOW); }}>
                  {b.label}<span className="dl-count">{loading ? '' : counts[b.id]}</span>
                </button>
              ))}
            </div>
            <input className="ad-input dl-search" type="search" aria-label="Search deliveries" placeholder="Order, customer, address or driver" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(SHOW); }} />
          </div>

          {loading ? (
            <div className="dl-cards" aria-busy="true" aria-label="Loading deliveries">
              {[0, 1, 2].map((i) => <div key={i} className="ad-skel" style={{ height: 220, borderRadius: 16 }} />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="card ad-empty">
              <div className="ad-empty-icon" aria-hidden="true">📦</div>
              {rows.length === 0 ? (<><strong>No deliveries yet</strong><span>When a customer orders for delivery, it shows up here so you can assign a driver.</span></>) : (<><strong>Nothing matches</strong><span>Try another filter or clear the search.</span><Button variant="ghost" onClick={() => { setBucket('all'); setSearch(''); }}>Show everything</Button></>)}
            </div>
          ) : (
            <>
              <div className="dl-cards">
                {shown.slice(0, limit).map((d) => <Card key={d.id} d={d} now={now} staffRows={staff.data} onAssign={(x) => setAssigning(x.id)} />)}
              </div>
              {shown.length > limit && <Button variant="ghost" onClick={() => setLimit((n) => n + SHOW)}>Show more ({shown.length - limit} left)</Button>}
            </>
          )}
          {q.data && !q.data.complete && <p className="an-note">Showing your latest 500 deliveries.</p>}

          {awaiting.length > 0 && (
            <section className="card ad-card-pad" aria-label="Orders without a delivery record">
              <h2 className="ad-card-title">Delivery orders with no delivery record</h2>
              <p className="an-sub">A driver can only be assigned once the order has a delivery record. These don’t have one yet, so they can’t be dispatched from here.</p>
              <ul className="dl-awaiting">
                {awaiting.map((o) => (
                  <li key={o.id}>
                    <span><Link href={`/owner/orders/${o.id}`}><strong>#{o.order_number}</strong></Link> · {STATUS_LABEL[o.status]}</span>
                    <span className="dl-sub">{timeAgo(o.created_at, now)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {assignTarget && <AssignModal delivery={assignTarget} activeCounts={activeCounts} onClose={() => setAssigning(null)} />}
    </DeliveryFrame>
  );
}
