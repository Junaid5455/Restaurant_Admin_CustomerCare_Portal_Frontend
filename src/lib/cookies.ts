import { COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_ROLE } from './constants';
import type { Role } from './types';

const isBrowser = () => typeof document !== 'undefined';

function write(name: string, value: string, expires: Date) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${secure}`;
}

function read(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function remove(name: string) {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/** Reads the `exp` claim (ms epoch) from a JWT without verifying it. */
function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

const DAY = 24 * 60 * 60 * 1000;

export function getAccessToken() {
  return read(COOKIE_ACCESS);
}
export function getRefreshToken() {
  return read(COOKIE_REFRESH);
}

export function setTokens(access: string, refresh: string) {
  // Access cookie expires slightly before the JWT so we refresh proactively instead of eating a 401.
  const exp = jwtExpiry(access);
  const accessExpires = new Date((exp ?? Date.now() + 55 * 60 * 1000) - 30 * 1000);
  write(COOKIE_ACCESS, access, accessExpires);
  write(COOKIE_REFRESH, refresh, new Date(Date.now() + 7 * DAY));
}

export function setRoleCookie(role: Role) {
  write(COOKIE_ROLE, role, new Date(Date.now() + 7 * DAY));
}

export function clearAuthCookies() {
  if (!isBrowser()) return;
  remove(COOKIE_ACCESS);
  remove(COOKIE_REFRESH);
  remove(COOKIE_ROLE);
}
