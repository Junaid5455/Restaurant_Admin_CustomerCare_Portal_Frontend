import type { Order, OrderStatus } from './api/orders';
import type { MenuItem } from './api/admin-menu';
import type { PeakHour, SalesPoint } from './api/admin-analytics';
import { toNumber } from './format';

export type Range = 7 | 14 | 30;
export const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];
export const SAMPLE_RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'All loaded' },
] as const;

const DAY = 86_400_000;

const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** The last `n` server days ending at the newest day the server returned (or today), with zeros for quiet days. */
export function lastDays(points: SalesPoint[], n: number, endKey?: string): SalesPoint[] {
  const by = new Map(points.map((p) => [p.date, p]));
  const end = endKey ?? points.map((p) => p.date).sort().pop() ?? key(new Date());
  const endMs = Date.parse(end + 'T00:00:00Z');
  const out: SalesPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = key(new Date(endMs - i * DAY));
    out.push(by.get(k) ?? { date: k, orders: 0, sales: 0, avg: 0 });
  }
  return out;
}

export interface SalesSummary {
  sales: number;
  orders: number;
  avg: number;
  best: SalesPoint | null;
}

export function summarise(points: SalesPoint[]): SalesSummary {
  const sales = points.reduce((s, p) => s + p.sales, 0);
  const orders = points.reduce((s, p) => s + p.orders, 0);
  const best = points.reduce<SalesPoint | null>((b, p) => (p.sales > (b?.sales ?? 0) ? p : b), null);
  return { sales, orders, avg: orders ? sales / orders : 0, best };
}

/** The window of `n` days and the `n` days before it, when the 30-day data is long enough to hold both. */
export function windows(points: SalesPoint[], n: number): { current: SalesPoint[]; previous: SalesPoint[] | null } {
  const all = lastDays(points, 30);
  const current = all.slice(all.length - n);
  const previous = n * 2 <= 30 ? all.slice(all.length - n * 2, all.length - n) : null;
  return { current, previous };
}

export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1000) return `${(n / 1000).toFixed(a >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

/** A y-axis maximum and ticks that land on round numbers. */
export function niceScale(max: number, ticks = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks: out };
}

/** "Oct 24" from a server day key. */
export function shortDay(k: string): string {
  return new Date(k + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function longDay(k: string): string {
  return new Date(k + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** The server reports hours in UTC. Show them in the viewer's own time zone. */
export function utcHourToLocal(h: number, at = new Date()): number {
  const offsetHours = -at.getTimezoneOffset() / 60;
  return (((h + offsetHours) % 24) + 24) % 24;
}

export function hourLabel(h: number): string {
  const whole = Math.floor(h);
  const frac = h - whole;
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${h12}${frac ? `:${String(Math.round(frac * 60)).padStart(2, '0')}` : ''} ${whole < 12 ? 'AM' : 'PM'}`;
}

export function peakHoursLocal(rows: PeakHour[]): { hour: number; orders: number }[] {
  return rows.map((r) => ({ hour: utcHourToLocal(r.hour), orders: r.orders })).sort((a, b) => b.orders - a.orders);
}

// ── Looking inside the loaded orders ─────────────────────────────────────────

const NOT_COUNTED: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

export function within(orders: Order[], days: number, now = Date.now()): Order[] {
  if (days <= 0) return orders;
  const since = now - days * DAY;
  return orders.filter((o) => Date.parse(o.created_at) >= since);
}

export interface ProductRow {
  key: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
}

/** Quantity and revenue per dish, leaving out cancelled and refunded orders. */
export function productStats(orders: Order[]): ProductRow[] {
  const map = new Map<string, ProductRow>();
  for (const o of orders) {
    if (NOT_COUNTED.includes(o.status)) continue;
    const seen = new Set<string>();
    for (const it of o.items ?? []) {
      const k = it.menu_item ?? `name:${it.item_name}`;
      const row = map.get(k) ?? { key: k, menuItemId: it.menu_item, name: it.item_name, quantity: 0, revenue: 0, orders: 0 };
      row.quantity += Number(it.quantity) || 0;
      row.revenue += toNumber(it.subtotal);
      if (!seen.has(k)) { row.orders += 1; seen.add(k); }
      map.set(k, row);
    }
  }
  return [...map.values()];
}

/** Menu dishes that appear in none of the given orders. */
export function unsoldDishes(menu: MenuItem[], orders: Order[]): MenuItem[] {
  const sold = new Set(productStats(orders).map((p) => p.menuItemId).filter(Boolean) as string[]);
  return menu.filter((m) => !sold.has(m.id));
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Orders placed per day of the week, in the viewer's time zone. */
export function byWeekday(orders: Order[]): number[] {
  const out = new Array(7).fill(0) as number[];
  for (const o of orders) {
    if (NOT_COUNTED.includes(o.status)) continue;
    const t = Date.parse(o.created_at);
    if (Number.isFinite(t)) out[new Date(t).getDay()] += 1;
  }
  return out;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const FORMULA = /^[=+\-@]/;
/** Stops a cell that starts with = + - @ from running as a formula when opened in a spreadsheet. */
export const guard = (v: string) => (FORMULA.test(v) ? `'${v}` : v);

export function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function makeCsv(rows: (string | number)[][]): string {
  // The leading BOM makes Excel read the file as UTF-8.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  downloadBlob(new Blob([makeCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

export const stamp = () => new Date().toISOString().slice(0, 10);
