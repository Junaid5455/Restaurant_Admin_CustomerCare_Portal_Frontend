'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Kpi } from './analytics-kit';
import { Pager } from './orders-kit';
import { ReservationsFrame } from './reservations-kit';
import { Chips, LoadError, TableSkeleton } from './super-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { RESERVATIONS_KEY, useReservations } from '@/hooks/use-admin-reservations';
import { useNow } from '@/hooks/use-now';
import { adminReservationsApi, type Reservation, type ReservationPage } from '@/lib/api/admin-reservations';
import { parseError } from '@/lib/errors';
import { canCancel, canConfirm, clock, groupByDay, inGroup, reservationStats, sortFor, statusInfo, timeOf, type Group } from '@/lib/reservations';
import { timeAgo } from '@/lib/time-ago';

const PAGE = 30;

function Row({ r, now, busy, onConfirm, onCancel }: { r: Reservation; now: number; busy: boolean; onConfirm: (r: Reservation) => void; onCancel: (r: Reservation) => void }) {
  const info = statusInfo(r.status);
  const t = timeOf(r);
  const who = r.customer_email || 'Guest';
  const past = t < now;
  return (
    <li className={`rs-row ${r.status === 'PENDING' && !past ? 'is-pending' : ''} ${r.status === 'CANCELLED' ? 'is-off' : ''}`} aria-label={`Booking for ${who} at ${clock(t)}`}>
      <div className="rs-time">{clock(t)}<small>{r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}</small></div>
      <div className="rs-main">
        <div className="rs-who">{who}</div>
        <div className="rs-meta">
          <span>{r.table_number ? `Table ${r.table_number}` : 'No table assigned'}</span>
          <span>Booked {timeAgo(r.created_at, now)}</span>
        </div>
        {r.special_requests?.trim() && <p className="rs-note"><span aria-hidden="true">📝 </span>{r.special_requests}</p>}
      </div>
      <div className="rs-side">
        <span className={`badge ${info.cls}`}>{info.text}</span>
        {(canConfirm(r, now) || canCancel(r, now)) && (
          <div className="rs-actions">
            {canConfirm(r, now) && <Button className="ad-btn-sm" disabled={busy} onClick={() => onConfirm(r)} aria-label={`Confirm booking for ${who}`}>Confirm</Button>}
            {canCancel(r, now) && <Button variant="ghost" className="ad-btn-sm" disabled={busy} onClick={() => onCancel(r)} aria-label={`${r.status === 'PENDING' ? 'Decline' : 'Cancel'} booking for ${who}`}>{r.status === 'PENDING' ? 'Decline' : 'Cancel'}</Button>}
          </div>
        )}
      </div>
    </li>
  );
}

export function ReservationsView() {
  const q = useReservations();
  const qc = useQueryClient();
  const { push } = useToast();
  const now = useNow(30_000);
  const [group, setGroup] = useState<Group>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);

  const all = useMemo(() => q.data?.reservations ?? [], [q.data]);
  const stats = useMemo(() => reservationStats(all, now), [all, now]);
  const count = (g: Group) => all.filter((r) => inGroup(r, g, now)).length;
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => inGroup(r, group, now) && (!s || [r.customer_email, r.table_number, r.special_requests].some((v) => v?.toLowerCase().includes(s)))).sort(sortFor(group));
  }, [all, group, search, now]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages);
  const view = shown.slice((at - 1) * PAGE, at * PAGE);
  const days = useMemo(() => groupByDay(view, now), [view, now]);

  const patch = (id: string, status: string) =>
    qc.setQueryData<ReservationPage>(RESERVATIONS_KEY, (cur) => (cur ? { ...cur, reservations: cur.reservations.map((r) => (r.id === id ? { ...r, status } : r)) } : cur));

  async function confirm(r: Reservation) {
    setBusyId(r.id);
    try {
      const saved = await adminReservationsApi.confirm(r.id);
      patch(r.id, saved?.status ?? 'CONFIRMED');
      push('Booking confirmed');
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel() {
    const r = toCancel;
    if (!r) return;
    setBusyId(r.id);
    try {
      await adminReservationsApi.cancel(r.id);
      patch(r.id, 'CANCELLED');
      push(r.status === 'PENDING' ? 'Booking declined' : 'Booking cancelled');
      setToCancel(null);
      void qc.invalidateQueries({ queryKey: RESERVATIONS_KEY });
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const reset = () => { setGroup('all'); setSearch(''); setPage(1); };
  const empty = shown.length === 0;

  return (
    <ReservationsFrame active="bookings" title="Reservations" description="Table bookings from guests. Confirm new ones so guests know they have a spot.">
      <div className="ad-kpis">
        <Kpi tone="coral" icon="🔔" label="Need confirming" value={q.data ? String(stats.needConfirming) : null} sub={stats.needConfirming ? 'Guests are waiting on you' : 'Nothing waiting'} loading={q.isPending} />
        <Kpi tone="violet" icon="📅" label="Today" value={q.data ? String(stats.today) : null} sub="Bookings still to come" loading={q.isPending} />
        <Kpi tone="teal" icon="🍽️" label="Guests today" value={q.data ? String(stats.guestsToday) : null} sub="Across today’s bookings" loading={q.isPending} />
        <Kpi tone="yellow" icon="🗓️" label="Next 7 days" value={q.data ? String(stats.next7) : null} sub="Pending or confirmed" loading={q.isPending} />
      </div>

      {q.isError ? <LoadError query={q} what="reservations" /> : q.isPending ? <TableSkeleton /> : (
        <>
          <div className="su-toolbar">
            <Chips label="Show" value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={[
              { id: 'pending', label: 'Needs confirming', count: count('pending') },
              { id: 'upcoming', label: 'Upcoming', count: count('upcoming') },
              { id: 'past', label: 'Past', count: count('past') },
              { id: 'cancelled', label: 'Cancelled', count: count('cancelled') },
              { id: 'all', label: 'All', count: all.length },
            ]} />
            <input className="ad-input su-search" type="search" aria-label="Search bookings" placeholder="Guest email, table or request" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>

          {empty ? (
            <div className="card ad-empty">
              <div className="ad-empty-icon" aria-hidden="true">{all.length === 0 ? '📅' : group === 'pending' && !search ? '🎉' : '🔍'}</div>
              {all.length === 0 ? (
                <><strong>No bookings yet</strong><span>When guests reserve a table, their bookings show up here. Add your tables so they have something to book.</span></>
              ) : group === 'pending' && !search ? (
                <><strong>Nothing to confirm</strong><span>Every new booking has an answer.</span><Button variant="ghost" onClick={() => setGroup('upcoming')}>See upcoming bookings</Button></>
              ) : (
                <><strong>Nothing here</strong><span>No bookings match these filters.</span><Button variant="ghost" onClick={reset}>Show all bookings</Button></>
              )}
            </div>
          ) : (
            days.map((d) => (
              <section key={d.key} className="rs-day" aria-label={d.label}>
                <div className="rs-day-h"><h2>{d.label}</h2><span>{d.rows.length} {d.rows.length === 1 ? 'booking' : 'bookings'} · {d.guests} {d.guests === 1 ? 'guest' : 'guests'}</span></div>
                <ul className="rs-list">
                  {d.rows.map((r) => <Row key={r.id} r={r} now={now} busy={busyId === r.id} onConfirm={(x) => void confirm(x)} onCancel={setToCancel} />)}
                </ul>
              </section>
            ))
          )}
          <Pager page={at} totalPages={pages} totalItems={shown.length} noun="bookings" onPage={setPage} />
          {q.data && q.data.total > all.length && <p className="an-note">Showing the latest {all.length} of {q.data.total} bookings.</p>}
        </>
      )}

      {toCancel && (
        <ConfirmDialog
          title={toCancel.status === 'PENDING' ? 'Decline this booking?' : 'Cancel this booking?'}
          message={`${toCancel.customer_email ?? 'The guest'} booked for ${toCancel.party_size} at ${clock(timeOf(toCancel))}. The booking will be marked cancelled. Please let the guest know if it is close to the time.`}
          confirmLabel={toCancel.status === 'PENDING' ? 'Decline booking' : 'Cancel booking'}
          busy={busyId === toCancel.id}
          onConfirm={() => void cancel()}
          onClose={() => busyId !== toCancel.id && setToCancel(null)}
        />
      )}
    </ReservationsFrame>
  );
}
