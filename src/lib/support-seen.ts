import { latestStaffAt, type Ticket } from './api/support';

/**
 * The API has no "read" flag for ticket replies, so we remember, per browser, when the customer last
 * opened each ticket. Always wrapped in try/catch: storage can be blocked or full.
 */
const KEY = 'sv_support_seen';

export function readSeen(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markSeen(ticketId: string, iso: string): void {
  try {
    const all = readSeen();
    if (all[ticketId] && Date.parse(all[ticketId]) >= Date.parse(iso)) return;
    all[ticketId] = iso;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function hasNewReply(t: Ticket, seen: Record<string, string>): boolean {
  const latest = latestStaffAt(t);
  if (!latest) return false;
  const last = seen[t.id];
  return !last || Date.parse(latest) > Date.parse(last);
}
