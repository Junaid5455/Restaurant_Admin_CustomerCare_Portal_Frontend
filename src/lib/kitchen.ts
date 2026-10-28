import type { KitchenOrder } from './api/kitchen';

export type Urgency = 'ok' | 'warn' | 'late';

export interface KdsPrefs {
  sound: boolean;
  /** Keep ringing every ~20 s until a new order is acknowledged. */
  repeat: boolean;
  /** Minutes a ticket should take when the order doesn't say. */
  targetMinutes: number;
  large: boolean;
}

export const DEFAULT_PREFS: KdsPrefs = { sound: true, repeat: true, targetMinutes: 20, large: false };
const PREFS_KEY = 'savoria-kds-prefs';
const STARTED_KEY = 'savoria-kds-started';

export function loadPrefs(): KdsPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<KdsPrefs>;
    const t = Number(raw.targetMinutes);
    return {
      sound: raw.sound !== false,
      repeat: raw.repeat !== false,
      targetMinutes: Number.isFinite(t) && t >= 1 && t <= 180 ? Math.round(t) : DEFAULT_PREFS.targetMinutes,
      large: raw.large === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: KdsPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode: the choice just lasts this session */
  }
}

/** When this device pressed "Start cooking". The API has no start time, so this is the only source for the cooking timer. */
export function loadStarted(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(STARTED_KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
  } catch {
    return {};
  }
}

export function saveStarted(map: Record<string, number>) {
  try {
    localStorage.setItem(STARTED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** The moment the kitchen's clock starts: when the order was confirmed, else when it was placed. */
export function clockStart(o: KitchenOrder): number {
  const t = Date.parse(o.confirmed_at ?? o.placed_at);
  return Number.isFinite(t) ? t : Date.now();
}

export function targetMinutes(o: KitchenOrder, prefs: KdsPrefs): number {
  const n = Number(o.estimated_preparation_time_minutes);
  return Number.isFinite(n) && n >= 1 ? n : prefs.targetMinutes;
}

/** "4:07", or "1:02:09" past an hour. Never negative. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Green until 60% of the target, amber until the target, red after. */
export function urgency(elapsedMs: number, targetMin: number): Urgency {
  const ratio = elapsedMs / (targetMin * 60_000);
  return ratio >= 1 ? 'late' : ratio >= 0.6 ? 'warn' : 'ok';
}

export const TYPE_LABEL = { DELIVERY: 'Delivery', PICKUP: 'Pickup', DINE_IN: 'Dine-in' } as const;
export const TYPE_ICON = { DELIVERY: '🛵', PICKUP: '🛍', DINE_IN: '🍽' } as const;

/** "ORD-20241016-0042" -> "0042" for the big label; the full number stays in the tooltip. */
export function shortNumber(n: string): string {
  const m = n.match(/(\d{3,})\s*$/);
  return m ? m[1].slice(-4) : n.slice(-6);
}

export function itemCount(o: KitchenOrder): number {
  return o.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}
