'use client';

import './kds.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrderTicket } from './order-ticket';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { useNow } from '@/hooks/use-now';
import { useKitchenActions, useKitchenOrders } from '@/hooks/use-kitchen';
import type { KitchenOrder } from '@/lib/api/kitchen';
import type { OrderType } from '@/lib/api/cart';
import type { ApiError } from '@/lib/errors';
import { ADMIN_LOGIN } from '@/lib/roles';
import { DEFAULT_PREFS, TYPE_LABEL, loadPrefs, loadStarted, savePrefs, saveStarted, shortNumber, type KdsPrefs } from '@/lib/kitchen';
import { audioReady, playChime, unlockAudio } from '@/lib/kitchen-sound';

const REMIND_MS = 20_000;
type Filter = 'ALL' | OrderType;

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="kds-toggle">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

/**
 * The full-screen kitchen board. `staff` is the kitchen team's own screen (/kitchen); `owner` is the same board opened
 * from the owner area, with a way back instead of a sign-out button.
 */
export function KdsView({ mode }: { mode: 'staff' | 'owner' }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { push } = useToast();
  const now = useNow(1000);
  const query = useKitchenOrders();
  const { run, pending } = useKitchenActions();
  const orders = query.data;

  const [prefs, setPrefs] = useState<KdsPrefs>(DEFAULT_PREFS);
  const [started, setStarted] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>('ALL');
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [announce, setAnnounce] = useState('');

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const known = useRef<Set<string> | null>(null);

  // Saved preferences load after the first paint so the server and browser render the same thing.
  useEffect(() => {
    setPrefs(loadPrefs());
    setStarted(loadStarted());
  }, []);

  const update = (patch: Partial<KdsPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  // Browsers keep sound locked until the page is touched once.
  useEffect(() => {
    if (audioReady()) setUnlocked(true);
    const unlock = () => void unlockAudio().then((ok) => ok && setUnlocked(true));
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // New-order detection. The first load only records what is already there, so opening the screen never rings.
  useEffect(() => {
    if (!orders) return;
    const ids = new Set(orders.map((o) => o.id));
    if (known.current === null) {
      known.current = ids;
      return;
    }
    const arrived = orders.filter((o) => !known.current!.has(o.id) && o.status === 'CONFIRMED');
    known.current = ids;
    setFresh((prev) => {
      const next = new Set([...prev, ...arrived.map((o) => o.id)].filter((id) => ids.has(id)));
      return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next;
    });
    if (arrived.length) {
      setAnnounce(`${arrived.length === 1 ? 'New order' : `${arrived.length} new orders`}: ${arrived.map((o) => shortNumber(o.order_number)).join(', ')}`);
      if (prefsRef.current.sound) playChime();
    }
    // Forget start times for tickets that have left the board.
    setStarted((s) => {
      const keep = Object.fromEntries(Object.entries(s).filter(([id]) => ids.has(id)));
      if (Object.keys(keep).length === Object.keys(s).length) return s;
      saveStarted(keep);
      return keep;
    });
  }, [orders]);

  // Keep ringing until someone acknowledges the new ticket.
  useEffect(() => {
    if (fresh.size === 0 || !prefs.sound || !prefs.repeat) return;
    const t = setInterval(() => playChime(), REMIND_MS);
    return () => clearInterval(t);
  }, [fresh.size, prefs.sound, prefs.repeat]);

  // Tab title shows the queue, so a hidden tab still tells the story.
  const waiting = orders?.filter((o) => o.status === 'CONFIRMED').length ?? 0;
  useEffect(() => {
    const base = 'Kitchen · Savoria';
    document.title = fresh.size > 0 ? `🔔 (${fresh.size}) New order · ${base}` : waiting > 0 ? `(${waiting}) ${base}` : base;
  }, [fresh.size, waiting]);
  useEffect(() => () => void (document.title = 'Savoria'), []);

  // Stop the screen going to sleep while the board is open.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const grab = async () => {
      try {
        if (!cancelled && document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed here: the screen just follows the device's own sleep setting */
      }
    };
    void grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', grab);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const ack = useCallback((id: string) => setFresh((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : s)), []);

  async function act(o: KitchenOrder, action: 'start' | 'ready') {
    ack(o.id);
    if (action === 'start') {
      setStarted((s) => {
        const next = { ...s, [o.id]: Date.now() };
        saveStarted(next);
        return next;
      });
    }
    const res = await run(o, action);
    if (res.ok) {
      if (action === 'ready') push(`Order ${shortNumber(o.order_number)} is ready`);
    } else {
      if (action === 'start') {
        setStarted((s) => {
          const rest = { ...s };
          delete rest[o.id];
          saveStarted(rest);
          return rest;
        });
      }
      push(res.error.status === 404 ? `Order ${shortNumber(o.order_number)} is no longer in the kitchen` : res.error.display, 'error');
    }
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: 0, PICKUP: 0, DELIVERY: 0, DINE_IN: 0 };
    orders?.forEach((o) => {
      c.ALL++;
      c[o.order_type]++;
    });
    return c;
  }, [orders]);

  const shown = useMemo(() => (orders ?? []).filter((o) => filter === 'ALL' || o.order_type === filter), [orders, filter]);
  const incoming = shown.filter((o) => o.status === 'CONFIRMED');
  const cooking = shown.filter((o) => o.status === 'PREPARING');

  const err = query.error as ApiError | null;
  const stale = orders ? Math.round((now - query.dataUpdatedAt) / 1000) : 0;
  const clock = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const ticket = (o: KitchenOrder) => (
    <OrderTicket
      key={o.id}
      order={o}
      now={now}
      prefs={prefs}
      startedAt={started[o.id]}
      fresh={fresh.has(o.id)}
      busy={pending.has(o.id)}
      onStart={() => act(o, 'start')}
      onReady={() => act(o, 'ready')}
      onAck={() => ack(o.id)}
    />
  );

  return (
    <div className={`kds ${prefs.large ? 'kds-large' : ''}`}>
      <header className="kds-top">
        <div className="kds-brand">
          <span className="kds-logo" aria-hidden="true">🍳</span>
          <div>
            <h1>Kitchen</h1>
            <span className="kds-sub">
              {query.isFetching && !orders ? 'Loading…' : orders ? (stale > 20 ? `Last update ${stale}s ago` : 'Live · updates every 5 s') : ''}
            </span>
          </div>
        </div>

        <div className="kds-pills" aria-label="Queue">
          <span className={`kds-pill ${fresh.size ? 'is-flash' : ''}`}><b>{orders?.filter((o) => o.status === 'CONFIRMED').length ?? 0}</b> new</span>
          <span className="kds-pill"><b>{orders?.filter((o) => o.status === 'PREPARING').length ?? 0}</b> cooking</span>
        </div>

        <div className="kds-filters" role="group" aria-label="Order type">
          {(['ALL', 'DINE_IN', 'PICKUP', 'DELIVERY'] as Filter[]).map((f) => (
            <button key={f} type="button" className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'All' : TYPE_LABEL[f]} <span>{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="kds-tools">
          <span className="kds-time" aria-label="Time now">{clock}</span>
          <button type="button" className="kds-icon" aria-label={prefs.sound ? 'Mute alerts' : 'Turn alerts on'} aria-pressed={prefs.sound} title={prefs.sound ? 'Sound on' : 'Sound off'} onClick={() => update({ sound: !prefs.sound })}>
            {prefs.sound ? '🔔' : '🔕'}
          </button>
          <div className="kds-pop-wrap">
            <button type="button" className="kds-icon" aria-label="Kitchen settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>⚙</button>
            {settingsOpen && (
              <div className="kds-pop" role="dialog" aria-label="Kitchen settings">
                <Toggle label="Sound alerts" hint="A chime when a new order arrives" checked={prefs.sound} onChange={(v) => update({ sound: v })} />
                <Toggle label="Keep ringing" hint="Repeat every 20 s until someone taps the ticket" checked={prefs.repeat} onChange={(v) => update({ repeat: v })} />
                <Toggle label="Large text" checked={prefs.large} onChange={(v) => update({ large: v })} />
                <label className="kds-field">
                  <strong>Target time (minutes)</strong>
                  <small>Tickets turn amber at 60% and red at 100%. Orders that carry their own prep time use that instead.</small>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={prefs.targetMinutes}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 1 && n <= 180) update({ targetMinutes: n });
                    }}
                  />
                </label>
                <button type="button" className="kds-btn" onClick={() => void unlockAudio().then((ok) => { setUnlocked(ok); if (!playChime()) push("This browser is blocking sound. Tap the page once and try again.", 'info'); })}>
                  Play test sound
                </button>
              </div>
            )}
          </div>
          {typeof document !== 'undefined' && document.fullscreenEnabled && (
            <button
              type="button"
              className="kds-icon"
              aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}
              title="Full screen"
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
            >
              {fullscreen ? '🗗' : '⛶'}
            </button>
          )}
          <ThemeToggle className="kds-icon" />
          {mode === 'owner' ? (
            <Link href="/owner" className="kds-btn">Exit</Link>
          ) : (
            <button type="button" className="kds-btn" onClick={async () => { await logout(); router.replace(ADMIN_LOGIN); }}>Sign out</button>
          )}
        </div>
      </header>

      {prefs.sound && !unlocked && (
        <button type="button" className="kds-banner is-info" onClick={() => void unlockAudio().then((ok) => setUnlocked(ok))}>
          🔊 Tap here (or anywhere) once to switch on sound alerts. Your browser keeps them off until then.
        </button>
      )}
      {err && orders && (
        <div className="kds-banner is-warn" role="alert">
          ⚠ Can't reach the server. Showing the list from {stale}s ago and retrying. Don't rely on this screen until it reconnects.
        </div>
      )}
      {fresh.size > 1 && (
        <button type="button" className="kds-banner is-new" onClick={() => setFresh(new Set())}>
          🔔 {fresh.size} new orders. Tap to silence.
        </button>
      )}

      <div className="sr-only" aria-live="assertive">{announce}</div>

      <main className="kds-board">
        {!orders && !err && <div className="kds-state"><span className="spinner spinner-lg" role="status" aria-label="Loading orders" /></div>}

        {!orders && err && (
          <div className="kds-state" role="alert">
            <strong>
              {err.status === 403 ? "This account can't open the kitchen screen" : err.status === 404 ? 'No restaurant is linked to this account' : "Can't load the kitchen"}
            </strong>
            <span>
              {err.status === 403
                ? mode === 'owner'
                  ? 'The server only lets kitchen staff accounts use this screen. See the step 7.5 backend notes to allow owners.'
                  : 'Ask the restaurant owner to check your role.'
                : err.status === 404
                  ? 'Ask the restaurant owner to add you to the staff list.'
                  : err.display}
            </span>
            {err.status !== 403 && err.status !== 404 && (
              <button type="button" className="kds-btn" onClick={() => void query.refetch()}>Try again</button>
            )}
          </div>
        )}

        {orders && (
          <>
            <section className="kds-col" aria-label="New orders">
              <h2>New <span>{incoming.length}</span></h2>
              {incoming.length === 0 ? <div className="kds-empty">{orders.length === 0 ? 'All caught up. New orders appear here.' : 'Nothing new.'}</div> : <div className="kds-grid">{incoming.map(ticket)}</div>}
            </section>
            <section className="kds-col" aria-label="Cooking">
              <h2>Cooking <span>{cooking.length}</span></h2>
              {cooking.length === 0 ? <div className="kds-empty">Nothing on the stove.</div> : <div className="kds-grid">{cooking.map(ticket)}</div>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
