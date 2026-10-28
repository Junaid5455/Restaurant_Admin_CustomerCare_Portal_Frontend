import type { Ticket, TicketCategory, TicketStatus } from './api/support';
import type { PlatformOrder, PlatformRestaurant, PlatformUser } from './api/super-admin';
import { toNumber } from './format';

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const PRIORITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
export const priorityBadge = (p: string) => (p === 'URGENT' ? 'badge-crit' : p === 'HIGH' ? 'badge-warn' : p === 'LOW' ? 'badge-neutral' : 'badge-accent');

export const ROLE_NAME: Record<string, string> = {
  CUSTOMER: 'Customer',
  RESTAURANT_OWNER: 'Restaurant owner',
  RESTAURANT_STAFF: 'Restaurant staff',
  DELIVERY_STAFF: 'Delivery staff',
  SUPER_ADMIN: 'Super admin',
};

export type RoleFilter = 'CUSTOMER' | 'OWNER' | 'STAFF' | 'ADMIN' | 'ALL';
export const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'CUSTOMER', label: 'Customers' },
  { id: 'OWNER', label: 'Restaurant owners' },
  { id: 'STAFF', label: 'Staff and drivers' },
  { id: 'ADMIN', label: 'Admins' },
  { id: 'ALL', label: 'Everyone' },
];
export function matchesRole(u: Pick<PlatformUser, 'role'>, f: RoleFilter): boolean {
  switch (f) {
    case 'CUSTOMER': return u.role === 'CUSTOMER';
    case 'OWNER': return u.role === 'RESTAURANT_OWNER';
    case 'STAFF': return u.role === 'RESTAURANT_STAFF' || u.role === 'DELIVERY_STAFF';
    case 'ADMIN': return u.role === 'SUPER_ADMIN';
    default: return true;
  }
}

export function userName(u: Pick<PlatformUser, 'first_name' | 'last_name' | 'email'>): string {
  return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
}

const DAY = 86_400_000;
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shortLabel = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const longLabel = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export interface DayPoint { label: string; long: string; value: number }

/** Counts per local day for the last `days` days, with zeros for quiet days, from any list of timestamps. */
export function perDay(stamps: (string | null | undefined)[], days: number, now = Date.now()): DayPoint[] {
  const counts = new Map<string, number>();
  for (const s of stamps) {
    const t = Date.parse(s ?? '');
    if (Number.isFinite(t)) counts.set(dayKey(t), (counts.get(dayKey(t)) ?? 0) + 1);
  }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * DAY;
    out.push({ label: shortLabel(t), long: longLabel(t), value: counts.get(dayKey(t)) ?? 0 });
  }
  return out;
}

/** Sums `amount` per local day for the same window. */
export function sumPerDay(rows: { at: string | null | undefined; amount: number }[], days: number, now = Date.now()): DayPoint[] {
  const sums = new Map<string, number>();
  for (const r of rows) {
    const t = Date.parse(r.at ?? '');
    if (Number.isFinite(t)) sums.set(dayKey(t), (sums.get(dayKey(t)) ?? 0) + r.amount);
  }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * DAY;
    out.push({ label: shortLabel(t), long: longLabel(t), value: sums.get(dayKey(t)) ?? 0 });
  }
  return out;
}

export function tally<T>(items: T[], pick: (x: T) => string | null | undefined): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = pick(i);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export const ratingOf = (r: Pick<PlatformRestaurant, 'rating'>): number | null => {
  const n = r.rating == null ? NaN : Number(r.rating);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const orderTime = (o: PlatformOrder) => o.placed_at ?? o.created_at ?? null;
export const orderAmount = (o: PlatformOrder) => toNumber(o.total_amount ?? 0);

/** The same rule the dashboard total uses: only delivered orders count as revenue. */
export const isRevenue = (o: PlatformOrder) => o.status === 'DELIVERED';

export function restaurantName(o: PlatformOrder, restaurants?: PlatformRestaurant[]): string {
  return o.restaurant_name || restaurants?.find((r) => r.id === o.restaurant)?.name || 'Unknown restaurant';
}

export interface RevenueRow { name: string; revenue: number; orders: number }
export function revenueByRestaurant(orders: PlatformOrder[], restaurants?: PlatformRestaurant[]): RevenueRow[] {
  const m = new Map<string, RevenueRow>();
  for (const o of orders.filter(isRevenue)) {
    const name = restaurantName(o, restaurants);
    const row = m.get(name) ?? { name, revenue: 0, orders: 0 };
    row.revenue += orderAmount(o);
    row.orders += 1;
    m.set(name, row);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface TicketStats {
  open: number;
  urgentOpen: number;
  oldestOpenAt: string | null;
  unanswered: number;
  byStatus: { key: TicketStatus; count: number }[];
  byCategory: { key: TicketCategory; count: number }[];
  byPriority: { key: string; count: number }[];
}
const OPEN: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_RESTAURANT'];
export const isOpenTicket = (t: Pick<Ticket, 'status'>) => OPEN.includes(t.status);
export const hasStaffReply = (t: Ticket) => t.messages.some((m) => m.message_type === 'STAFF_MESSAGE');

export function ticketStats(tickets: Ticket[]): TicketStats {
  const open = tickets.filter(isOpenTicket);
  const oldest = [...open].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
  return {
    open: open.length,
    urgentOpen: open.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length,
    oldestOpenAt: oldest?.created_at ?? null,
    unanswered: open.filter((t) => !hasStaffReply(t)).length,
    byStatus: tally(tickets, (t) => t.status) as TicketStats['byStatus'],
    byCategory: tally(tickets, (t) => t.category) as TicketStats['byCategory'],
    byPriority: tally(tickets, (t) => t.priority),
  };
}

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
/** What to look at first: urgent, then oldest. */
export const byAttention = (a: Ticket, b: Ticket) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || Date.parse(a.created_at) - Date.parse(b.created_at);
