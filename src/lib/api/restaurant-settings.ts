import { api } from '../http';
import { call } from './call';

/* ───────────── Types (verified against apps/restaurants serializers, models and views) ───────────── */

/**
 * RestaurantSettingsSerializer. Served at GET/PATCH /restaurants/settings/ for the signed-in owner
 * (the backend finds the restaurant with `owner=request.user`, so there is no id to pass).
 */
export interface RestaurantSettings {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  /** "HH:MM:SS" */
  opening_time: string;
  closing_time: string;
  is_open: boolean;
  allows_pickup: boolean;
  allows_delivery: boolean;
  allows_dine_in: boolean;
  /** Decimal strings. */
  min_order_amount: string;
  delivery_fee: string;
  delivery_time_minutes: number;
  /** A percentage: the order total adds subtotal × tax_rate ÷ 100. */
  tax_rate: string;
}

export type SettingsPatch = Partial<Omit<RestaurantSettings, 'id' | 'logo' | 'banner'>>;

/** /restaurants/holidays/ */
export interface Holiday {
  id: string;
  /** YYYY-MM-DD */
  holiday_date: string;
  reason: string | null;
  created_at: string;
}

/** /restaurants/delivery-zones/ */
export interface Zone {
  id: string;
  zone_name: string;
  delivery_fee: string;
  delivery_time_minutes: number;
  /** Comma-separated. */
  postal_codes: string;
  is_active: boolean;
}
export type ZoneInput = Omit<Zone, 'id'>;

type Maybe<T> = T[] | { results: T[] };
const list = <T,>(res: Maybe<T>): T[] => (Array.isArray(res) ? res : res.results);

/* ───────────── Small helpers ───────────── */

/** "09:30:00" → "09:30" for <input type="time">. */
export const toHHMM = (t: string | null | undefined) => (t ?? '').slice(0, 5);

/** "a, b  c\nd" → ["a","b","c","d"] (trimmed, no blanks, no duplicates, original case kept). */
export function parsePostalCodes(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\s]+/)) {
    const code = raw.trim();
    if (!code || seen.has(code.toLowerCase())) continue;
    seen.add(code.toLowerCase());
    out.push(code);
  }
  return out;
}

/* ───────────── Calls ───────────── */

export const restaurantSettingsApi = {
  get: () => call<RestaurantSettings>(() => api.get('/restaurants/settings/')),

  patch: (patch: SettingsPatch) => call<RestaurantSettings>(() => api.patch('/restaurants/settings/', patch)),

  /** Logo and banner are real upload fields on this serializer (unlike the customer's profile picture). */
  uploadImage(field: 'logo' | 'banner', file: File) {
    const body = new FormData();
    body.append(field, file);
    return call<RestaurantSettings>(() => api.patch('/restaurants/settings/', body));
  },

  async holidays(): Promise<Holiday[]> {
    const res = await call<Maybe<Holiday>>(() => api.get('/restaurants/holidays/', { params: { page_size: 100 } }));
    return list(res).sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  },
  addHoliday: (holiday_date: string, reason: string) =>
    call<Holiday>(() => api.post('/restaurants/holidays/', { holiday_date, reason: reason.trim() || null })),
  async removeHoliday(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/restaurants/holidays/${id}/`));
  },

  async zones(): Promise<Zone[]> {
    const res = await call<Maybe<Zone>>(() => api.get('/restaurants/delivery-zones/', { params: { page_size: 100 } }));
    return list(res);
  },
  addZone: (z: ZoneInput) => call<Zone>(() => api.post('/restaurants/delivery-zones/', z)),
  updateZone: (id: string, z: Partial<ZoneInput>) => call<Zone>(() => api.patch(`/restaurants/delivery-zones/${id}/`, z)),
  async removeZone(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/restaurants/delivery-zones/${id}/`));
  },
};
