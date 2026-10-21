import { useSyncExternalStore } from 'react';
import type { OrderType } from './api/cart';

/**
 * App preferences live on this device only (localStorage): the backend has no place for them and they are
 * about how this browser looks and behaves, not about the account. Storage can be unavailable or throw
 * (private windows, blocked cookies), so everything falls back to defaults and never throws.
 */
export interface AppPrefs {
  /** Pre-selects this at checkout when the restaurant offers it. null = first available. */
  orderType: OrderType | null;
  reduceMotion: boolean;
}

export const DEFAULT_APP_PREFS: AppPrefs = { orderType: null, reduceMotion: false };

export const APP_PREFS_KEY = 'savoria-app-prefs';
/** Everything else this app keeps in the browser, for the Privacy page's "clear" button. */
const DEVICE_KEYS = [APP_PREFS_KEY, 'sv_support_seen'];
const EVENT = 'savoria-app-prefs-change';

const ORDER_TYPES: OrderType[] = ['DELIVERY', 'PICKUP', 'DINE_IN'];

export function readAppPrefs(): AppPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(APP_PREFS_KEY) ?? '{}') as Partial<AppPrefs>;
    return {
      orderType: ORDER_TYPES.includes(raw.orderType as OrderType) ? (raw.orderType as OrderType) : null,
      reduceMotion: raw.reduceMotion === true,
    };
  } catch {
    return DEFAULT_APP_PREFS;
  }
}

export function writeAppPrefs(patch: Partial<AppPrefs>): boolean {
  const next = { ...readAppPrefs(), ...patch };
  try {
    localStorage.setItem(APP_PREFS_KEY, JSON.stringify(next));
  } catch {
    window.dispatchEvent(new Event(EVENT));
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  return true;
}

/** Applies preferences that act on the whole document. */
export function applyAppPrefs(p: AppPrefs) {
  const el = document.documentElement;
  if (p.reduceMotion) el.setAttribute('data-motion', 'reduced');
  else el.removeAttribute('data-motion');
}

/** Removes what this app stored in the browser (not the theme, which has its own control). */
export function clearDeviceData(): number {
  let removed = 0;
  for (const k of DEVICE_KEYS) {
    try {
      if (localStorage.getItem(k) !== null) removed++;
      localStorage.removeItem(k);
    } catch {
      /* nothing to clear */
    }
  }
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (k === 'savoria-checkout') {
        sessionStorage.removeItem(k);
        removed++;
      }
    }
  } catch {
    /* ignore */
  }
  applyAppPrefs(DEFAULT_APP_PREFS);
  window.dispatchEvent(new Event(EVENT));
  return removed;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// useSyncExternalStore needs a stable snapshot between changes, so cache by the raw string.
let lastRaw: string | null = null;
let lastValue: AppPrefs = DEFAULT_APP_PREFS;
function snapshot(): AppPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(APP_PREFS_KEY);
  } catch {
    /* unavailable */
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastValue = readAppPrefs();
  }
  return lastValue;
}

export function useAppPrefs(): AppPrefs {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_APP_PREFS);
}
