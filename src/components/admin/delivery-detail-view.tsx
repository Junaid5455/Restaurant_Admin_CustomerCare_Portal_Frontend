'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AssignModal, DeliveryFrame, EtaTag, StatusBadge, StepButton } from './deliveries-kit';
import { Button } from '@/components/ui/submit-button';
import { useDeliveries, useDelivery } from '@/hooks/use-admin-delivery';
import { useStaff } from '@/hooks/use-admin-staff';
import { useNow } from '@/hooks/use-now';
import { driverLabel, hasPin, isFinished, isOnTheRoad, mapsLinkForAddress, mapsLinkForPin, minutesBetween, pinIsStale, timeline } from '@/lib/delivery';
import { parseError } from '@/lib/errors';
import { timeAgo } from '@/lib/time-ago';

const DeliveryMap = dynamic(() => import('./delivery-map').then((m) => m.DeliveryMap), { ssr: false, loading: () => <div className="ad-skel" style={{ height: 320, borderRadius: 16 }} aria-hidden="true" /> });

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);

export function DeliveryDetailView({ id }: { id: string }) {
  const q = useDelivery(id);
  const list = useDeliveries();
  const staff = useStaff();
  const now = useNow(15_000);
  const [assigning, setAssigning] = useState(false);

  const activeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of list.data?.rows ?? []) if (d.driver && !isFinished(d.status)) m[d.driver] = (m[d.driver] ?? 0) + 1;
    return m;
  }, [list.data]);

  const d = q.data;
  if (q.isPending) {
    return (
      <DeliveryFrame active={null} title="Delivery" description="Loading…">
        <div aria-busy="true" aria-label="Loading delivery"><div className="ad-skel" style={{ height: 260, borderRadius: 16 }} /></div>
      </DeliveryFrame>
    );
  }
  if (q.isError || !d) {
    const err = q.error ? parseError(q.error) : null;
    return (
      <DeliveryFrame active={null} title="Delivery" description="">
        <div className="card ad-empty" role="alert">
          <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
          <strong>{err?.status === 404 ? 'We couldn’t find that delivery' : 'We couldn’t load this delivery'}</strong>
          <span>{err?.status === 404 ? 'It may have been removed, or it belongs to another restaurant.' : err?.display}</span>
          {err?.status !== 404 && <Button onClick={() => void q.refetch()}>Try again</Button>}
          <Link className="btn btn-ghost" href="/owner/deliveries">← All deliveries</Link>
        </div>
      </DeliveryFrame>
    );
  }

  const who = d.driver ? driverLabel(d, staff.data, d.driver) : null;
  const pin = hasPin(d) && !isFinished(d.status);
  const stale = pin && pinIsStale(d, now);
  const steps = timeline(d);
  const canAssign = !isFinished(d.status) && !isOnTheRoad(d.status);
  const took = d.actual_delivery_time_minutes ?? minutesBetween(d.created_at, d.delivered_at);

  return (
    <DeliveryFrame
      active={null}
      title={`Delivery · #${d.order_number}`}
      description={d.restaurant_name ?? ''}
      actions={<Link className="btn btn-ghost" href="/owner/deliveries">← All deliveries</Link>}
    >
      <div className="card ad-card-pad" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={d.driver || isFinished(d.status) ? d.status : 'PENDING'} />
          <EtaTag d={d} now={now} />
          <span className="dl-sub">{who ? `Driver: ${who}` : 'No driver yet'}</span>
        </div>
        <div className="dl-card-actions">
          {canAssign && <Button onClick={() => setAssigning(true)}>{d.driver ? 'Change driver' : 'Assign driver'}</Button>}
          <StepButton delivery={d} />
          <Link className="btn btn-ghost" href={`/owner/orders/${d.order}`}>View order</Link>
        </div>
      </div>

      <div className="dl-detail">
        <div className="ad-stack">
          <section className="card ad-card-pad" aria-label="Driver location">
            <div className="an-panel-head">
              <div>
                <h2 className="ad-card-title">Driver location</h2>
                <p className="an-sub">{pin ? `Seen ${timeAgo(d.last_location_update, now) || 'just now'}${stale ? ' — may be out of date' : ''}` : 'No location has been shared yet'}</p>
              </div>
              {pin && <a className="an-link" href={mapsLinkForPin(d)} target="_blank" rel="noreferrer noopener">Open in OpenStreetMap ↗</a>}
            </div>
            {pin ? (
              <DeliveryMap pins={[{ id: d.id, lat: Number(d.current_latitude), lng: Number(d.current_longitude), label: who ?? 'Driver', sub: `order ${d.order_number}`, stale }]} selectedId={d.id} height={320} label="Map showing the driver’s last known location" />
            ) : (
              <div className="ad-empty ad-empty-flush">
                <span aria-hidden="true" className="ad-empty-icon">📡</span>
                <span>{isFinished(d.status) ? 'This delivery is finished.' : d.driver ? 'The map appears once the driver shares their location from the driver page.' : 'Assign a driver first.'}</span>
              </div>
            )}
          </section>

          <section className="card ad-card-pad" aria-label="Progress">
            <h2 className="ad-card-title">Progress</h2>
            {d.status === 'CANCELLED' && <p className="an-note">This delivery was cancelled.</p>}
            <ol className="dl-steps">
              {steps.map((s) => (
                <li key={s.key} className={s.at ? 'done' : ''}>
                  <span className="dl-step-dot" aria-hidden="true" />
                  <span>
                    {s.label}
                    <small>{s.at ? fmt(s.at) : 'Not yet'}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="card ad-card-pad" aria-label="Delivery details">
          <h2 className="ad-card-title">Details</h2>
          <dl className="dl-facts">
            <dt>Customer</dt><dd>{d.customer_email ?? '—'}</dd>
            <dt>Deliver to</dt>
            <dd>
              {d.delivery_address || '—'}
              {d.delivery_address && <> · <a className="an-link" href={mapsLinkForAddress(d.delivery_address)} target="_blank" rel="noreferrer noopener">Map ↗</a></>}
            </dd>
            <dt>Instructions</dt><dd>{d.delivery_instructions || 'None'}</dd>
            <dt>Pick up from</dt><dd>{d.pickup_address || d.restaurant_name || '—'}</dd>
            <dt>Estimated time</dt><dd>{d.estimated_delivery_time_minutes != null ? `${d.estimated_delivery_time_minutes} min` : '—'}</dd>
            <dt>Actual time</dt><dd>{took != null ? `${took} min` : '—'}</dd>
            <dt>Rating</dt><dd>{d.delivery_rating ? `${Number(d.delivery_rating).toFixed(1)} / 5` : 'Not rated'}</dd>
          </dl>
        </section>
      </div>

      {assigning && <AssignModal delivery={d} activeCounts={activeCounts} onClose={() => setAssigning(false)} />}
    </DeliveryFrame>
  );
}
