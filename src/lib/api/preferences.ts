import { api } from '../http';
import { call } from './call';
import { ApiError } from '../errors';

/**
 * Notification preferences, stored server-side in the users app (NotificationPreference).
 * The server only reads these four flags when deciding who receives campaigns and order messages.
 */
export interface NotificationPrefs {
  order_updates: boolean;
  email_promotions: boolean;
  sms_promotions: boolean;
  push_promotions: boolean;
}
export type PrefKey = keyof NotificationPrefs;

/** What a brand-new customer gets. Matches the values sent at signup. */
export const DEFAULT_PREFS: NotificationPrefs = {
  order_updates: true,
  email_promotions: true,
  sms_promotions: false,
  push_promotions: true,
};

export interface PrefsRecord extends NotificationPrefs {
  /** Present when /users/preferences/ is a list endpoint; absent when it is a single-object endpoint. */
  id?: string | number;
}

const KEYS = Object.keys(DEFAULT_PREFS) as PrefKey[];

function looksLikePrefs(v: unknown): v is PrefsRecord {
  return !!v && typeof v === 'object' && KEYS.some((k) => typeof (v as Record<string, unknown>)[k] === 'boolean');
}

/** Accepts a list, a paginated list or a single object, and fills any flag the server doesn't send. */
function normalise(raw: unknown): PrefsRecord | null {
  let row: unknown = raw;
  if (Array.isArray(raw)) row = raw[0];
  else if (raw && typeof raw === 'object' && Array.isArray((raw as { results?: unknown }).results)) {
    row = (raw as { results: unknown[] }).results[0];
  }
  if (!looksLikePrefs(row)) return null;
  const out: PrefsRecord = { ...DEFAULT_PREFS, id: row.id };
  for (const k of KEYS) if (typeof row[k] === 'boolean') out[k] = row[k];
  return out;
}

const URL = '/users/preferences/';

export const preferencesApi = {
  /** Returns null when the customer has no row yet (older accounts, or signup couldn't create one). */
  async get(): Promise<PrefsRecord | null> {
    try {
      return normalise(await call<unknown>(() => api.get(URL)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  /** Updates one or more flags. Creates the row first if the customer never had one. */
  async save(current: PrefsRecord | null, patch: Partial<NotificationPrefs>): Promise<PrefsRecord> {
    if (!current) {
      const created = normalise(await call<unknown>(() => api.post(URL, { ...DEFAULT_PREFS, ...patch })));
      return created ?? { ...DEFAULT_PREFS, ...patch };
    }
    const target = current.id !== undefined ? `${URL}${current.id}/` : URL;
    const updated = normalise(await call<unknown>(() => api.patch(target, patch)));
    // Some servers answer with an empty body; fall back to what we asked for.
    return updated ?? { ...current, ...patch };
  },
};
