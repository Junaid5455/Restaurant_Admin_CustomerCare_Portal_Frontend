import type { Role } from './types';

/** Edge-safe (used by middleware): no browser or node APIs in here. */
export const ROLE_HOME: Record<Role, string> = {
  CUSTOMER: '/customer',
  RESTAURANT_OWNER: '/owner',
  RESTAURANT_STAFF: '/kitchen',
  DELIVERY_STAFF: '/driver',
  SUPER_ADMIN: '/admin',
};

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Customer',
  RESTAURANT_OWNER: 'Restaurant Owner',
  RESTAURANT_STAFF: 'Kitchen Staff',
  DELIVERY_STAFF: 'Delivery Driver',
  SUPER_ADMIN: 'Super Admin',
};

export const PROTECTED_PREFIXES = Object.values(ROLE_HOME);

export function isRole(value: string | undefined | null): value is Role {
  return !!value && value in ROLE_HOME;
}

export function homeForRole(role: Role): string {
  return ROLE_HOME[role];
}

/** Only follow ?next= if it is an internal path inside this role's own area (blocks open redirects). */
export function safeNext(next: string | null | undefined, role: Role): string {
  const home = ROLE_HOME[role];
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return home;
  if (next === home || next.startsWith(home + '/') || next.startsWith(home + '?')) return next;
  return home;
}
