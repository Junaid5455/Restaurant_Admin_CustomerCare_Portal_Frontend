import { api } from '../http';
import { call } from './call';
import type { User } from '../types';

export interface ProfileInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

/** GET /users/rewards/ */
export interface Rewards {
  loyalty_points: number;
  total_orders: number;
  total_spent: string;
}

/** GET /users/gift-cards/ (only the customer's active cards). */
export interface GiftCard {
  id: string;
  code: string;
  initial_amount: string;
  balance: string;
  is_active: boolean;
  expires_at: string | null;
}

type Maybe<T> = T[] | { results: T[] };

export const accountApi = {
  /** PUT /users/me/ is a partial update. Editable: first_name, last_name, email, phone. */
  updateProfile: (input: ProfileInput) =>
    call<User>(() =>
      api.put('/users/me/', {
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim() || null,
      }),
    ),

  /**
   * Multipart upload to the same endpoint. NOTE: CustomUserSerializer currently lists `profile_picture` in
   * read_only_fields, so the server accepts the request but ignores the file. Remove it from read_only_fields
   * to make this work; the page detects the "ignored" case and tells the customer.
   */
  updatePicture(file: File) {
    const body = new FormData();
    body.append('profile_picture', file);
    return call<User>(() => api.put('/users/me/', body));
  },

  async changePassword(oldPassword: string, newPassword: string, confirm: string): Promise<void> {
    await call<unknown>(() =>
      api.post('/users/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirm: confirm,
      }),
    );
  },

  rewards: () => call<Rewards>(() => api.get('/users/rewards/')),

  async giftCards(): Promise<GiftCard[]> {
    const res = await call<Maybe<GiftCard>>(() => api.get('/users/gift-cards/', { params: { page_size: 100 } }));
    return Array.isArray(res) ? res : res.results;
  },
};
