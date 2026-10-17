import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './constants';
import { clearAuthCookies, getAccessToken, getRefreshToken, setTokens } from './cookies';

/** No auth, no interceptors: login, register, refresh, password reset, email verification. */
export const publicApi = axios.create({ baseURL: API_URL, timeout: 20000 });

/** Authenticated client: attaches the bearer token and transparently refreshes it. */
export const api = axios.create({ baseURL: API_URL, timeout: 20000 });

/**
 * Unwraps the SuccessResponse envelope { success, message, data } if present.
 * Other shapes (DRF {count,results}, bare arrays/objects) pass through untouched.
 */
export function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'success' in body && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Refresh tokens ROTATE and the old one is blacklisted, so two parallel refreshes would log the user out.
 * Every caller shares one in-flight promise.
 */
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) throw new Error('No refresh token');
      // users/token/refresh/ is plain SimpleJWT: { access, refresh }, not wrapped in the envelope.
      const res = await publicApi.post<{ access: string; refresh?: string }>('/users/token/refresh/', { refresh });
      setTokens(res.data.access, res.data.refresh ?? refresh);
      return res.data.access;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Returns a usable access token, refreshing first if the cookie has expired. */
export async function ensureAccessToken(): Promise<string | null> {
  const current = getAccessToken();
  if (current) return current;
  if (!getRefreshToken()) return null;
  try {
    return await refreshAccessToken();
  } catch {
    return null;
  }
}

function endSession() {
  clearAuthCookies();
  if (typeof window !== 'undefined' && !/^\/(login|register|forgot-password|reset-password|verify-email)/.test(window.location.pathname)) {
    window.location.assign('/login?expired=1');
  }
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await ensureAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

type Retriable = AxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as Retriable | undefined;
    if (error.response?.status === 401 && original && !original._retry && getRefreshToken()) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      } catch {
        endSession();
      }
    }
    return Promise.reject(error);
  },
);
