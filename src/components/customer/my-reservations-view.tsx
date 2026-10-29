'use client';

import './reservations.css';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { MY_RESERVATIONS_KEY, useMyReservations } from '@/hooks/use-my-reservations';
import { useNow } from '@/hooks/use-now';
import { reservationsApi, type Reservation, type ReservationPage } from '@/lib/api/reservations';
import { parseError } from '@/lib/errors';
import { canGuestCancel, guestStatus, sortTab, tabOf, type Tab } from '@/lib/my-reservations';
import { clock, timeOf } from '@/lib/reservations';

function Card({ r, now, busy, onCancel }: { r: Reservation; now: number; busy: boolean; onCancel: (r: Reservation) => void }) {
  const t = new Date(timeOf(r));
  const info = guestStatus(r.status);
  const name = r.restaurant_name || 'Restaurant';
  return (
    <article className={`card rv-card ${r.status === 'CANCELLED' ? 'is-off' : ''}`} aria-label={`${name}, ${t.toDateString()} at ${clock(t.getTime())}`}>
      <div className="rv-when" aria-hidden="true">
        <span className="d">{t.toLocaleDateString('en-US', { weekday: 'short', month: 'short' })}</span>
        <span className="n">{t.getDate()}</span>
        <span className="t">{clock(t.getTime())}</span>
      </div>
      <div className="rv-main">
        <h2>{name}</h2>
        <div className="rv-meta">
          <span>👥 {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}</span>
          <span>📅 {t.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {clock(t.getTime())}</span>
          {r.table_number && <span>🪑 Table {r.table_number}</span>}
        </div>
        {info.help && <p className="rv-help">{info.help}</p>}
        {r.special_requests?.trim() && <p className="rv-note">📝 {r.special_requests}</p>}
      </div>
      <div className="rv-side">
        <span className={`badge ${info.cls}`}>{info.text}</span>
        {canGuestCancel(r, now) && <Button variant="ghost" disabled={busy} onClick={() => onCancel(r)} aria-label={`Cancel booking at ${name}`}>Cancel booking</Button>}
      </div>
    </article>
  );
}

export function MyReservationsView() {
  const q = useMyReservations();
  const qc = useQueryClient();
  const { push } = useToast();
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab | null>(null);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => q.data?.reservations ?? [], [q.data]);
  const counts = useMemo(() => ({ upcoming: all.filter((r) => tabOf(r, now) === 'upcoming').length, past: all.filter((r) => tabOf(r, now) === 'past').length, cancelled: all.filter((r) => tabOf(r, now) === 'cancelled').length }), [all, now]);
  // Open on "Upcoming", or on the first tab that has something when there is nothing coming up.
  const active: Tab = tab ?? (counts.upcoming > 0 || all.length === 0 ? 'upcoming' : counts.past > 0 ? 'past' : 'cancelled');
  const shown = useMemo(() => all.filter((r) => tabOf(r, now) === active).sort(sortTab(active)), [all, active, now]);

  async function cancel() {
    const r = toCancel;
    if (!r) return;
    setBusy(true);
    try {
      await reservationsApi.cancel(r.id);
      qc.setQueryData<ReservationPage>(MY_RESERVATIONS_KEY, (cur) => (cur ? { ...cur, reservations: cur.reservations.map((x) => (x.id === r.id ? { ...x, status: 'CANCELLED' } : x)) } : cur));
      push('Booking cancelled');
      setToCancel(null);
      void qc.invalidateQueries({ queryKey: MY_RESERVATIONS_KEY });
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sv-page-head sv-support-head">
        <div>
          <h1>Reservations</h1>
          <p>Book a table and keep track of your plans.</p>
        </div>
        <Link href="/customer/reservations/new" className="btn btn-primary">+ Book a table</Link>
      </div>

      {q.isPending ? (
        <div className="rv-cards" aria-busy="true" aria-label="Loading your reservations">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="sv-skel" style={{ height: 110, borderRadius: 16 }} />)}
        </div>
      ) : q.isError ? (
        <div className="sv-acct-inline">
          <Alert>{parseError(q.error).display}</Alert>
          <Button variant="ghost" onClick={() => void q.refetch()}>Try again</Button>
        </div>
      ) : all.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">📅</div>
          <h2>No reservations yet</h2>
          <p>Pick a restaurant, choose a time, and we’ll hold a table for you.</p>
          <Link href="/customer/reservations/new" className="btn btn-primary">Book a table</Link>
        </div>
      ) : (
        <>
          <div className="sv-seg" role="group" aria-label="Show reservations">
            {([['upcoming', 'Upcoming'], ['past', 'Past'], ['cancelled', 'Cancelled']] as const).map(([id, text]) => (
              <button key={id} type="button" aria-pressed={active === id} className={active === id ? 'active' : ''} onClick={() => setTab(id)}>
                {text}<span className="count">{counts[id]}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="sv-state" style={{ paddingTop: 36, paddingBottom: 36 }}>
              <div className="emoji" aria-hidden="true">{active === 'upcoming' ? '🍽' : '🗂'}</div>
              <h2>{active === 'upcoming' ? 'Nothing coming up' : active === 'past' ? 'No past bookings' : 'No cancelled bookings'}</h2>
              {active === 'upcoming' && <><p>Plan a night out?</p><Link href="/customer/reservations/new" className="btn btn-primary">Book a table</Link></>}
            </div>
          ) : (
            <div className="rv-cards">{shown.map((r) => <Card key={r.id} r={r} now={now} busy={busy && toCancel?.id === r.id} onCancel={setToCancel} />)}</div>
          )}
        </>
      )}

      {toCancel && (
        <ConfirmDialog
          title="Cancel this booking?"
          message={`Your table for ${toCancel.party_size} at ${toCancel.restaurant_name ?? 'the restaurant'} on ${new Date(timeOf(toCancel)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${clock(timeOf(toCancel))} will be released.`}
          confirmLabel="Cancel booking"
          busy={busy}
          onConfirm={() => void cancel()}
          onClose={() => !busy && setToCancel(null)}
        />
      )}
    </>
  );
}
