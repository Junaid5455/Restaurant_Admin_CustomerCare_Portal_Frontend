import { api, ensureAccessToken, publicApi, unwrap } from '../http';
import { getRefreshToken } from '../cookies';
import { parseError } from '../errors';
import type { AuthPayload, RegisterInput, User } from '../types';

/** Wraps a request so every failure surfaces as a normalised ApiError. */
async function call<T>(fn: () => Promise<{ data: unknown }>): Promise<T> {
  try {
    const res = await fn();
    return unwrap<T>(res.data);
  } catch (e) {
    throw parseError(e);
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    call<AuthPayload>(() => publicApi.post('/users/login/', { email, password })),

  register: (input: RegisterInput) => {
    // Optional fields are only sent when filled (blank phone would otherwise be stored as "").
    const body: Record<string, string> = {
      email: input.email,
      password: input.password,
      password_confirm: input.password_confirm,
    };
    if (input.first_name) body.first_name = input.first_name;
    if (input.last_name) body.last_name = input.last_name;
    if (input.phone) body.phone = input.phone;
    return call<AuthPayload>(() => publicApi.post('/users/register/', body));
  },

  me: () => call<User>(() => api.get('/users/me/')),

  /** Best-effort: blacklists the refresh token server-side. Never throws. */
  async logout() {
    try {
      // Make sure the access token is fresh first: refreshing rotates the refresh token,
      // so we must read the refresh token AFTER that, or we'd send an already-blacklisted one.
      await ensureAccessToken();
      const refresh = getRefreshToken();
      if (refresh) await api.post('/users/logout/', { refresh_token: refresh });
    } catch {
      /* local cleanup still happens */
    }
  },

  forgotPassword: (email: string) =>
    call<null>(() => publicApi.post('/users/forgot-password/', { email })),

  resetPassword: (token: string, new_password: string, new_password_confirm: string) =>
    call<null>(() => publicApi.post('/users/reset-password/', { token, new_password, new_password_confirm })),

  verifyEmail: (token: string) =>
    call<null>(() => publicApi.post('/users/verify-email/', { token })),

  /** Logged-in users: resend to their own address. */
  requestVerification: () => call<null>(() => api.post('/users/request-verification/')),

  /** Logged-out users: resend by email address. */
  sendVerification: (email: string) =>
    call<null>(() => publicApi.post('/users/send-verification/', { email })),

  /**
   * Campaigns only reach customers who have a NotificationPreference row and the users signal
   * doesn't create one, so we create it (with the backend's defaults) right after signup.
   */
  createDefaultPreferences: () =>
    call<unknown>(() =>
      api.post('/users/preferences/', {
        email_promotions: true,
        sms_promotions: false,
        push_promotions: true,
        order_updates: true,
      }),
    ),
};
