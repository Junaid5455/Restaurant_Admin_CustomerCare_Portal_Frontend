import type { Order, OrderStatus } from './api/orders';
import { toNumber } from './format';

/**
 * Pure maths behind the dashboard KPIs, so it can be read (and tested) without any UI.
 * All "days" are the browser's local calendar days, which for a restaurant owner is the restaurant's day.
 */

export const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
const NOT_REVENUE: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

export interface DayTotals {
  orders: number;
  revenue: number;
}

export interface DayBar extends DayTotals {
  key: string;
  /** "Mon" etc. */
  label: string;
  isToday: boolean;
}

export interface DashboardSummary {
  restaurantName: string | null;
  today: DayTotals;
  yesterday: DayTotals;
  active: number;
  awaiting: number;
  todayByStatus: Partial<Record<OrderStatus, number>>;
  last7: DayBar[];
  recent: Order[];
  /** False when the order list was longer than what we loaded, so older days may be under-counted. */
  complete: boolean;
  sampleSize: number;
  totalOrders: number;
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Percentage change, or null when there is nothing to compare against. */
export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export function summarise(orders: Order[], totalItems: number, now: Date = new Date()): DashboardSummary {
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const days = new Map<string, DayBar>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.set(dayKey(d), {
      key: dayKey(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isToday: i === 0,
      orders: 0,
      revenue: 0,
    });
  }

  const todayByStatus: Partial<Record<OrderStatus, number>> = {};
  let active = 0;
  let awaiting = 0;

  for (const o of orders) {
    if (ACTIVE_STATUSES.includes(o.status)) {
      active++;
      if (o.status === 'PLACED') awaiting++;
    }
    const created = new Date(o.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const key = dayKey(created);
    if (key === todayKey) todayByStatus[o.status] = (todayByStatus[o.status] ?? 0) + 1;
    const bar = days.get(key);
    if (!bar) continue;
    bar.orders += 1;
    if (!NOT_REVENUE.includes(o.status)) bar.revenue += toNumber(o.total_amount);
  }

  const names = new Set(orders.map((o) => o.restaurant_name).filter(Boolean));
  const recent = [...orders].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 6);
  const t = days.get(todayKey)!;
  const y = days.get(yesterdayKey)!;

  return {
    restaurantName: names.size === 1 ? [...names][0] : null,
    today: { orders: t.orders, revenue: t.revenue },
    yesterday: { orders: y.orders, revenue: y.revenue },
    active,
    awaiting,
    todayByStatus,
    last7: [...days.values()],
    recent,
    complete: orders.length >= totalItems,
    sampleSize: orders.length,
    totalOrders: Math.max(totalItems, orders.length),
  };
}
