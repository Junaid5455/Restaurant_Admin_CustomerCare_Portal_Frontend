import type { Ticket } from './api/support';
import { isActiveTicket } from './api/support';

/**
 * Helpers for the restaurant owner's Tickets pages.
 *
 * The backend never moves a ticket to "waiting for customer" when staff reply, so "whose turn is it?" is worked out
 * from the conversation itself: the opening description counts as the customer's first message, then whoever wrote
 * last is the one the ball is with.
 */

type Turn = 'us' | 'customer';

export function lastMessageAt(t: Ticket): number {
  return t.messages.reduce((n, m) => Math.max(n, Date.parse(m.created_at) || 0), Date.parse(t.created_at) || 0);
}

/** Who spoke last. A ticket with no messages yet was last spoken to by the customer (their description). */
export function lastSpeaker(t: Ticket): 'customer' | 'staff' {
  if (!t.messages.length) return 'customer';
  const last = [...t.messages].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).at(-1)!;
  return last.message_type === 'STAFF_MESSAGE' ? 'staff' : 'customer';
}

/** Still open and the customer has the last word, so the restaurant owes a reply. */
export const needsReply = (t: Ticket): boolean => isActiveTicket(t) && lastSpeaker(t) === 'customer';

export const turnOf = (t: Ticket): Turn => (lastSpeaker(t) === 'customer' ? 'us' : 'customer');

export type TicketGroup = 'reply' | 'open' | 'done' | 'all';

export function inGroup(t: Ticket, g: TicketGroup): boolean {
  switch (g) {
    case 'reply':
      return needsReply(t);
    case 'open':
      return isActiveTicket(t);
    case 'done':
      return !isActiveTicket(t);
    default:
      return true;
  }
}

export interface OwnerTicketStats {
  needReply: number;
  open: number;
  /** The oldest ticket that is still waiting on us, as an ISO date. */
  oldestWaitingAt: string | null;
  doneThisWeek: number;
}

export function ownerTicketStats(tickets: Ticket[], now: number = Date.now()): OwnerTicketStats {
  const waiting = tickets.filter(needsReply);
  const oldest = [...waiting].sort((a, b) => lastMessageAt(a) - lastMessageAt(b))[0];
  const week = now - 7 * 86_400_000;
  return {
    needReply: waiting.length,
    open: tickets.filter(isActiveTicket).length,
    oldestWaitingAt: oldest ? new Date(lastMessageAt(oldest)).toISOString() : null,
    doneThisWeek: tickets.filter((t) => !isActiveTicket(t) && lastMessageAt(t) >= week).length,
  };
}

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Tickets that need us first (urgent, then the longest-waiting); everything else newest activity first. */
export function sortForOwner(a: Ticket, b: Ticket): number {
  const na = needsReply(a);
  const nb = needsReply(b);
  if (na !== nb) return na ? -1 : 1;
  if (na && nb) return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || lastMessageAt(a) - lastMessageAt(b);
  return lastMessageAt(b) - lastMessageAt(a);
}

export const MAX_ATTACHMENT = 5 * 1024 * 1024;
export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
