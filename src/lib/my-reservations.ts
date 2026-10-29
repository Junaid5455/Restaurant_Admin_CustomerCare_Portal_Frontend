import type { Reservation } from './api/reservations';
import { isActiveStatus, isCancelled, timeOf } from './reservations';

/** What a guest sees for each status (the owner pages use their own wording). */
const GUEST: Record<string, { text: string; cls: string; help: string }> = {
  PENDING: { text: 'Awaiting confirmation', cls: 'badge-warn', help: 'The restaurant will confirm your table soon.' },
  CONFIRMED: { text: 'Confirmed', cls: 'badge-good', help: 'Your table is booked. See you there!' },
  CANCELLED: { text: 'Cancelled', cls: 'badge-crit', help: 'This booking was cancelled.' },
  COMPLETED: { text: 'Completed', cls: 'badge-neutral', help: 'Thanks for dining with us.' },
  NO_SHOW: { text: 'Missed', cls: 'badge-crit', help: 'The restaurant marked this booking as missed.' },
  SEATED: { text: 'Seated', cls: 'badge-violet', help: '' },
};

export function guestStatus(status: string): { text: string; cls: string; help: string } {
  const known = GUEST[status];
  if (known) return known;
  const words = status.toLowerCase().replace(/_/g, ' ');
  return { text: words.charAt(0).toUpperCase() + words.slice(1), cls: 'badge-neutral', help: '' };
}

export type Tab = 'upcoming' | 'past' | 'cancelled';

/** A guest can cancel until the booking starts (the server refuses after that). */
export const canGuestCancel = (r: Reservation, now: number) => isActiveStatus(r) && timeOf(r) > now;

export function tabOf(r: Reservation, now: number): Tab {
  if (isCancelled(r)) return 'cancelled';
  // Pending or confirmed bookings stay "upcoming" until they start; everything else is history.
  return isActiveStatus(r) && timeOf(r) > now ? 'upcoming' : 'past';
}

export function sortTab(tab: Tab) {
  return (a: Reservation, b: Reservation) => (tab === 'upcoming' ? timeOf(a) - timeOf(b) : timeOf(b) - timeOf(a));
}

/** "2026-10-31" in the guest's own time zone. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const MAX_ADVANCE_DAYS = 90;
export const PARTY_MAX = 20;
export const NOTE_MAX = 500;
