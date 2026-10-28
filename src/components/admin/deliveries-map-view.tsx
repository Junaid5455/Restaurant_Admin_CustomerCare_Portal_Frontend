'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DeliveryFrame, EtaTag, StatusBadge } from './deliveries-kit';
import type { MapPin } from './delivery-map';
import { Button } from '@/components/ui/submit-button';
import { useDeliveries } from '@/hooks/use-admin-delivery';
import { useStaff } from '@/hooks/use-admin-staff';
import { useNow } from '@/hooks/use-now';
import { driverLabel, hasPin, isFinished, isOnTheRoad, pinIsStale } from '@/lib/delivery';
import { parseError } from '@/lib/errors';
import { timeAgo } from '@/lib/time-ago';

const DeliveryMap = dynamic(() => import('./delivery-map').then((m) => m.DeliveryMap), { ssr: false, loading: () => <div className="ad-skel" style={{ height: 460, borderRadius: 16 }} aria-hidden="true" /> });

export function DeliveriesMapView() {
  const q = useDeliveries();
  const staff = useStaff();
  const now = useNow(15_000);
  const [selected, setSelected] = useState<string | null>(null);

  const live = useMemo(() => (q.data?.rows ?? []).filter((d) => d.driver && !isFinished(d.status)), [q.data]);
  const located = live.filter(hasPin);
  const silent = live.filter((d) => !hasPin(d));
  const pins: MapPin[] = located.map((d) => {
    const who = driverLabel(d, staff.data, d.driver);
    return { id: d.id, lat: Number(d.current_latitude), lng: Number(d.current_longitude), label: who, sub: `order ${d.order_number}`, stale: pinIsStale(d, now) };
  });
  const current = live.find((d) => d.id === selected) ?? null;

  return (
    <DeliveryFrame active="map" title="Live map" description="Where your drivers are, refreshed every 15 seconds." actions={<span aria-live="polite">{q.isFetching && !q.isPending ? 'Updating…' : q.dataUpdatedAt ? `Updated ${timeAgo(q.dataUpdatedAt, now) || 'just now'}` : ''}</span>}>
      {q.isError ? (
        <div className="card ad-empty" role="alert">
          <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
          <strong>We couldn&apos;t load deliveries</strong>
          <span>{parseError(q.error).display}</span>
          <Button onClick={() => void q.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="dl-map-layout">
            <div>
              {q.isPending ? <div className="ad-skel" style={{ height: 460, borderRadius: 16 }} aria-busy="true" aria-label="Loading map" /> : <DeliveryMap pins={pins} selectedId={selected} onSelect={setSelected} height={460} />}
              {!q.isPending && pins.length === 0 && (
                <p className="an-note" role="status" style={{ marginTop: 10 }}>
                  {live.length === 0 ? 'No deliveries are in progress, so there is nobody to show.' : 'None of your drivers are sharing a location right now.'}
                </p>
              )}
            </div>
            <section className="card dl-side" aria-label="Drivers on the map">
              <div className="ad-card-head"><h2 className="ad-card-title">In progress</h2><span className="ad-card-meta">{live.length}</span></div>
              {live.length === 0 ? (
                <div className="ad-empty ad-empty-flush"><span>Nothing out right now.</span></div>
              ) : (
                <ul>
                  {live.map((d) => (
                    <li key={d.id}>
                      <button type="button" className={selected === d.id ? 'on' : ''} aria-pressed={selected === d.id} onClick={() => setSelected(d.id)}>
                        <strong>{driverLabel(d, staff.data, d.driver)} · #{d.order_number}</strong>
                        <span className="dl-sub">{hasPin(d) ? `Seen ${timeAgo(d.last_location_update, now) || 'just now'}${pinIsStale(d, now) ? ' (may be out of date)' : ''}` : 'Not sharing a location'}</span>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><StatusBadge status={d.status} /><EtaTag d={d} now={now} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {current && (
            <section className="card ad-card-pad" aria-label="Selected delivery">
              <h2 className="ad-card-title">#{current.order_number} · {driverLabel(current, staff.data, current.driver)}</h2>
              <p className="dl-addr"><span aria-hidden="true">📍</span><span>{current.delivery_address || 'No address on this order'}</span></p>
              {isOnTheRoad(current.status) ? null : <p className="an-note">The driver hasn’t picked this order up yet.</p>}
              <div><Link className="btn btn-primary" href={`/owner/deliveries/${current.id}`}>Open delivery →</Link></div>
            </section>
          )}
          {silent.length > 0 && located.length > 0 && <p className="an-note">{silent.length} {silent.length === 1 ? 'driver isn’t' : 'drivers aren’t'} sharing a location, so {silent.length === 1 ? 'they are' : 'they’re'} not on the map.</p>}
        </>
      )}
    </DeliveryFrame>
  );
}
