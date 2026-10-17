export const COOKIE_ACCESS = 'sv_access';
export const COOKIE_REFRESH = 'sv_refresh';
/** Mirrors user.role so middleware can route before render. UX only: the API enforces real permissions. */
export const COOKIE_ROLE = 'sv_role';
export const THEME_KEY = 'savoria-theme';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
export const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? 'Rs';
