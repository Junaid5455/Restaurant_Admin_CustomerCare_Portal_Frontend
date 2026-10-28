'use client';

import './driver.css';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { deliveryError, useAdvance, useDeliveries } from '@/hooks/use-admin-delivery';
import { useNow } from '@/hooks/use-now';
import { adminDeliveryApi, type AdminDelivery } from '@/lib/api/admin-delivery';
import { DELIVERY_LABEL, STEP_LABEL, etaText, isFinished, mapsLinkForAddress, nextStep } from '@/lib/delivery';
import { parseError } from '@/lib/errors';
import { timeAgo } from '@/lib/time-ago';

const SEND_EVERY_MS = 15_000;

type Share = { state: 'off' } | { state: 'asking' } | { state: 'on'; sentAt: number | null; error: string | null; gps: boolean } | { state: 'blocked'; message: string };

/**
 * Sends the phone's position for every unfinished delivery of this driver, at most every 15 seconds.
 * The browser only allows this on https (or localhost) and only while the page is open.
 */
function useShareLocation(targets: AdminDelivery[]) {
  const [share, setShare] = useState<Share>({ state: 'off' });
  const latest = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const lastSent = useRef(0);
  const ids = useRef<string[]>([]);
  ids.current = targets.map((t) => t.id);
  const on = share.state === 'asking' || share.state === 'on';

  const send = useCallback(async () => {
    const pos = latest.current;
    if (!pos || !ids.current.length || pos.at <= lastSent.current) return;
    lastSent.current = pos.at;
    const results = await Promise.allSettled(ids.current.map((id) => adminDeliveryApi.updateLocation(id, pos.lat, pos.lng)));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    setShare((s) => (s.state === 'on' || s.state === 'asking' ? { state: 'on', gps: false, sentAt: failed ? (s.state === 'on' ? s.sentAt : null) : Date.now(), error: failed ? parseError(failed.reason).display : null } : s));
  }, []);

  useEffect(() => {
    if (!on) return;
    if (!('geolocation' in navigator)) {
      setShare({ state: 'blocked', message: 'This device or browser can’t share a location.' });
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        latest.current = { lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() };
        setShare((s) => (s.state === 'asking' ? { state: 'on', sentAt: null, error: null, gps: false } : s.state === 'on' && s.gps ? { ...s, gps: false } : s));
        if (Date.now() - lastSent.current >= SEND_EVERY_MS) void send();
      },
      (e) => {
        // Only a refusal ends sharing. A weak signal or a timeout comes and goes, so keep watching.
        if (e.code === e.PERMISSION_DENIED) setShare({ state: 'blocked', message: 'Location is blocked. Allow it for this site in your browser settings, then switch sharing on again.' });
        else setShare((s) => (s.state === 'on' ? { ...s, gps: true } : s));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    const timer = setInterval(() => void send(), SEND_EVERY_MS);
    return () => {
      navigator.geolocation.clearWatch(watch);
      clearInterval(timer);
    };
  }, [on, send]);

  return {
    share,
    start: () => { lastSent.current = 0; latest.current = null; setShare({ state: 'asking' }); },
    stop: () => setShare({ state: 'off' }),
  };
}

function StepCard({ d, now }: { d: AdminDelivery; now: number }) {
  const { push } = useToast();
  const advance = useAdvance();
  const step = nextStep(d);
  const eta = etaText(d, now);
  const tone = d.status === 'PICKED_UP' || d.status === 'IN_TRANSIT' ? 'violet' : 'accent';
  return (
    <article className="dr-card" aria-label={`Delivery for order ${d.order_number}`}>
      <div className="dr-order">
        <div>
          <h2>#{d.order_number}</h2>
          <div className="dr-sub">{d.customer_email ?? 'Customer'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`dr-badge ${tone}`}>{DELIVERY_LABEL[d.status]}</span>
          {eta && <div className={eta.late ? 'dr-late' : 'dr-sub'}>{eta.text}</div>}
        </div>
      </div>
      <div>
        <div className="dr-sub">Deliver to</div>
        <div className="dr-addr">{d.delivery_address || 'No address on this order'}</div>
      </div>
      {d.delivery_instructions && <div className="dr-note">📝 {d.delivery_instructions}</div>}
      <div className="dr-row">
        {d.delivery_address && <a className="dr-link" href={mapsLinkForAddress(d.delivery_address)} target="_blank" rel="noreferrer noopener">Open in Maps ↗</a>}
        {d.pickup_address && <span className="dr-sub">Pick up: {d.pickup_address}</span>}
      </div>
      {step && (
        <button
          type="button"
          className="dr-btn primary"
          disabled={advance.isPending}
          onClick={() =>
            advance.mutate(
              { id: d.id, step },
              {
                onSuccess: () => push(step === 'pickup' ? `Order #${d.order_number} picked up` : `Order #${d.order_number} delivered. Nice work!`),
                onError: (e) => push(deliveryError(e), 'error'),
              },
            )
          }
        >
          {advance.isPending ? 'Updating…' : STEP_LABEL[step]}
        </button>
      )}
    </article>
  );
}

export function DriverView() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const q = useDeliveries();
  const now = useNow(30_000);
  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const current = useMemo(() => rows.filter((d) => !isFinished(d.status)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)), [rows]);
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const done = rows.filter((d) => d.status === 'DELIVERED' && d.delivered_at && Date.parse(d.delivered_at) >= startOfDay.getTime());
  const { share, start, stop } = useShareLocation(current);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';
  const sharing = share.state === 'asking' || share.state === 'on';

  return (
    <div className="dr">
      <header className="dr-top">
        <div className="dr-brand">
          <span aria-hidden="true" style={{ fontSize: 26 }}>🛵</span>
          <div style={{ minWidth: 0 }}>
            <h1>My deliveries</h1>
            <small>{name}</small>
          </div>
        </div>
        <ThemeToggle className="dr-icon" />
        <button type="button" className="dr-btn" onClick={async () => { await logout(); router.replace('/login'); }}>Sign out</button>
      </header>

      <main className="dr-main">
        <section className={`dr-card dr-share ${share.state === 'on' ? 'on' : ''}`} aria-label="Location sharing">
          <div>
            <strong id="dr-share-label">Share my location</strong>
            <small id="dr-share-help" role="status">
              {share.state === 'off' && 'Lets the restaurant and your customers see where you are. Only while this page is open.'}
              {share.state === 'asking' && 'Waiting for your phone to find you…'}
              {share.state === 'on' && (share.gps ? 'Sharing · looking for a stronger signal…' : share.error ? <span className="dr-err">Couldn’t send: {share.error}</span> : share.sentAt ? `Sharing · last sent ${timeAgo(share.sentAt, now) || 'just now'}` : 'Sharing · sending your first position…')}
              {share.state === 'blocked' && <span className="dr-err">{share.message}</span>}
            </small>
            {sharing && current.length === 0 && <small>Nothing to send it for until you get a delivery.</small>}
          </div>
          <label className="dr-switch">
            <input type="checkbox" role="switch" aria-labelledby="dr-share-label" aria-describedby="dr-share-help" checked={sharing} onChange={(e) => (e.target.checked ? start() : stop())} />
            <span aria-hidden="true" />
          </label>
        </section>

        {q.isPending ? (
          <div aria-busy="true" aria-label="Loading deliveries"><div className="dr-skel" /></div>
        ) : q.isError ? (
          <div className="dr-card dr-empty" role="alert">
            <strong>We couldn’t load your deliveries</strong>
            <span>{parseError(q.error).display}</span>
            <button type="button" className="dr-btn" onClick={() => void q.refetch()}>Try again</button>
          </div>
        ) : (
          <>
            <h2 className="dr-h">To deliver · {current.length}</h2>
            {current.length === 0 ? (
              <div className="dr-card dr-empty"><div aria-hidden="true" style={{ fontSize: 32 }}>☕</div><strong>Nothing to deliver right now</strong><span>New deliveries appear here by themselves.</span></div>
            ) : (
              current.map((d) => <StepCard key={d.id} d={d} now={now} />)
            )}
            {done.length > 0 && (
              <>
                <h2 className="dr-h">Delivered today · {done.length}</h2>
                {done.map((d) => (
                  <div key={d.id} className="dr-card" style={{ padding: 12 }}>
                    <div className="dr-order">
                      <strong>#{d.order_number}</strong>
                      <span className="dr-badge good">Delivered {timeAgo(d.delivered_at, now)}</span>
                    </div>
                    <div className="dr-sub">{d.delivery_address}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
