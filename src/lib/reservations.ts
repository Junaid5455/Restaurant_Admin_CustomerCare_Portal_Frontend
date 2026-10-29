import type { DiningTable, Reservation } from './api/admin-reservations';

/** Status words the backend views set; anything else the model adds falls back to a tidied version of the code. */
const LABELS: Record<string, { text: string; cls: string }> = {
  PENDING: { text: 'Needs confirming', cls: 'badge-warn' },
  CONFIRMED: { text: 'Confirmed', cls: 'badge-good' },
  CANCELLED: { text: 'Cancelled', cls: 'badge-crit' },
  COMPLETED: { text: 'Completed', cls: 'badge-neutral' },
  SEATED: { text: 'Seated', cls: 'badge-violet' },
  NO_SHOW: { text: 'No-show', cls: 'badge-crit' },
};

export function statusInfo(status: string): { text: string; cls: string } {
  const known = LABELS[status];
  if (known) return known;
  const words = status.toLowerCase().replace(/_/g, ' ');
  return { text: words.charAt(0).toUpperCase() + words.slice(1), cls: 'badge-neutral' };
}

export const isCancelled = (r: Pick<Reservation, 'status'>) => r.status === 'CANCELLED';
export const isActiveStatus = (r: Pick<Reservation, 'status'>) => r.status === 'PENDING' || r.status === 'CONFIRMED';

export const timeOf = (r: Pick<Reservation, 'reservation_time'>) => Date.parse(r.reservation_time);

/** A booking is still "live" until two hours after its start, so tonight's 7pm table doesn't vanish at 7:01. */
const GRACE_MS = 2 * 60 * 60 * 1000;
export const isLive = (r: Reservation, now: number) => isActiveStatus(r) && timeOf(r) >= now - GRACE_MS;

/** Owners can only act on bookings that haven't started yet. */
export const canConfirm = (r: Reservation, now: number) => r.status === 'PENDING' && timeOf(r) >= now - GRACE_MS;
export const canCancel = (r: Reservation, now: number) => isActiveStatus(r) && timeOf(r) >= now - GRACE_MS;

export type Group = 'pending' | 'upcoming' | 'past' | 'cancelled' | 'all';

export function inGroup(r: Reservation, g: Group, now: number): boolean {
  switch (g) {
    case 'pending':
      return r.status === 'PENDING' && isLive(r, now);
    case 'upcoming':
      return isLive(r, now);
    case 'past':
      return !isCancelled(r) && !isLive(r, now);
    case 'cancelled':
      return isCancelled(r);
    default:
      return true;
  }
}

/** Soonest first for what is coming; newest first for history. */
export const sortFor = (g: Group) => (a: Reservation, b: Reservation) => (g === 'pending' || g === 'upcoming' ? timeOf(a) - timeOf(b) : timeOf(b) - timeOf(a));

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function dayLabel(t: number, now: number): string {
  const key = dayKey(t);
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(now + 86_400_000)) return 'Tomorrow';
  if (key === dayKey(now - 86_400_000)) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(new Date(t).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
}

export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export interface DayGroup {
  key: string;
  label: string;
  rows: Reservation[];
  guests: number;
}

/** Keeps the incoming order and starts a new group whenever the calendar day changes. */
export function groupByDay(rows: Reservation[], now: number): DayGroup[] {
  const out: DayGroup[] = [];
  for (const r of rows) {
    const t = timeOf(r);
    const key = dayKey(t);
    let g = out.at(-1);
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(t, now), rows: [], guests: 0 };
      out.push(g);
    }
    g.rows.push(r);
    if (!isCancelled(r)) g.guests += r.party_size || 0;
  }
  return out;
}

export interface ReservationStats {
  needConfirming: number;
  today: number;
  guestsToday: number;
  next7: number;
}

export function reservationStats(rows: Reservation[], now: number): ReservationStats {
  const today = dayKey(now);
  const weekEnd = now + 7 * 86_400_000;
  const live = rows.filter((r) => isLive(r, now));
  const todays = live.filter((r) => dayKey(timeOf(r)) === today);
  return {
    needConfirming: rows.filter((r) => r.status === 'PENDING' && isLive(r, now)).length,
    today: todays.length,
    guestsToday: todays.reduce((n, r) => n + (r.party_size || 0), 0),
    next7: live.filter((r) => timeOf(r) <= weekEnd).length,
  };
}

export const tableSummary = (tables: DiningTable[]) => {
  const active = tables.filter((t) => t.is_active);
  return { count: tables.length, active: active.length, seats: active.reduce((n, t) => n + (t.capacity || 0), 0) };
};

/** Natural-ish order for table labels: "2" before "10", "T-2" before "T-10". */
export const byTableNumber = (a: DiningTable, b: DiningTable) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: 'base' });
