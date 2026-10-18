import { API_URL, CURRENCY_SYMBOL } from './constants';

const whole = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** DRF returns DecimalFields as strings ("12.50"). */
export function toNumber(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return `${CURRENCY_SYMBOL} ${Number.isInteger(n) ? whole.format(n) : cents.format(n)}`;
}

/** "+Rs 50" / "−Rs 20" / "" for option price modifiers. */
export function formatModifier(v: string | number | null | undefined): string {
  const n = toNumber(v);
  if (n === 0) return '';
  return `${n > 0 ? '+' : '−'}${formatMoney(Math.abs(n))}`;
}

function parseTime(t?: string | null): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "23:00:00" -> "11:00 PM" */
export function formatTime(t?: string | null): string {
  const mins = parseTime(t);
  if (mins === null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

interface OpenInfo {
  opening_time?: string;
  closing_time?: string;
  is_open_now: boolean;
}

/**
 * The API's `is_open_now` compares opening hours against UTC, so it is wrong unless hours are stored in UTC.
 * When the response includes the hours we compare against the viewer's local clock instead,
 * and fall back to the API flag only when the hours aren't available (e.g. the list serializer).
 */
export function isOpenNow(r: OpenInfo, now: Date = new Date()): boolean {
  const open = parseTime(r.opening_time);
  const close = parseTime(r.closing_time);
  if (open === null || close === null) return r.is_open_now;
  const current = now.getHours() * 60 + now.getMinutes();
  return open <= current && current <= close;
}

/** Serializers called without request context return relative /media/... URLs; make them absolute. */
export function mediaUrl(src?: string | null): string | null {
  if (!src) return null;
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src;
  try {
    const origin = new URL(API_URL).origin;
    return `${origin}${src.startsWith('/') ? '' : '/'}${src}`;
  } catch {
    return src;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}
