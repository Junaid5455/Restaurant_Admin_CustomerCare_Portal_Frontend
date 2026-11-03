import type { Reservation } from './api/reservations';
import { isActiveStatus, timeOf } from './reservations';

/** "I'm ordering food for my booked table." Kept for the browser session so Menu, Cart and Checkout all know about it. */
export interface DineIn {
  restaurant: string;
  table: string;
  guests: number;
  /** ISO date-time of the booking. */
  when: string;
}

const KEY = 'sv-dine-in';
const TWO_HOURS = 2 * 60 * 60 * 1000;

export function readDineIn(): DineIn | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DineIn>;
    return typeof d.restaurant === 'string' && d.restaurant ? { restaurant: d.restaurant, table: String(d.table ?? ''), guests: Number(d.guests) || 2, when: String(d.when ?? '') } : null;
  } catch {
    return null;
  }
}

export function saveDineIn(d: DineIn) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage blocked: the order is simply not pre-filled */ }
}

export function clearDineIn() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** A guest can order food for a booking that is still waiting or confirmed and has not ended (bookings last about two hours). */
export const canOrderFood = (r: Reservation, now: number) => isActiveStatus(r) && timeOf(r) + TWO_HOURS > now;

/** The Menu page, opened for this booking. */
export function dineInHref(r: Pick<Reservation, 'restaurant' | 'table_number' | 'party_size' | 'reservation_time'>) {
  const q = new URLSearchParams({ restaurant: r.restaurant, dinein: '1', guests: String(r.party_size), at: r.reservation_time });
  if (r.table_number) q.set('table', r.table_number);
  return `/customer/menu?${q.toString()}`;
}
