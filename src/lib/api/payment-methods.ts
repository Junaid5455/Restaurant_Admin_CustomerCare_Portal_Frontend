import { api } from '../http';
import { call } from './call';

/**
 * SavedPaymentMethodSerializer. It also returns a `token` field (the gateway reference); the UI never uses or
 * shows it, so it isn't part of this type.
 */
export interface SavedPaymentMethod {
  id: string;
  payment_method_type: string;
  is_default: boolean;
  card_last_four: string | null;
  card_brand: string | null;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
}

type Maybe<T> = T[] | { results: T[] };

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  PAYPAL: 'PayPal',
  STRIPE: 'Card',
  CASH_ON_DELIVERY: 'Cash on delivery',
  CASH_AT_RESTAURANT: 'Cash at restaurant',
};

async function list(): Promise<SavedPaymentMethod[]> {
  const res = await call<Maybe<SavedPaymentMethod>>(() => api.get('/payments/methods/', { params: { page_size: 100 } }));
  return Array.isArray(res) ? res : res.results;
}

export const paymentMethodsApi = {
  list,

  /**
   * The server only clears other defaults on create, not on update, so do it here: others first, then the new
   * default. If the last step fails the customer is left with no default instead of two.
   */
  async setDefault(id: string): Promise<void> {
    const all = await list();
    await Promise.all(
      all
        .filter((m) => m.id !== id && m.is_default)
        .map((m) => call<unknown>(() => api.patch(`/payments/methods/${m.id}/`, { is_default: false }))),
    );
    await call<unknown>(() => api.patch(`/payments/methods/${id}/`, { is_default: true }));
  },

  async remove(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/payments/methods/${id}/`));
  },
};

export function isExpired(m: Pick<SavedPaymentMethod, 'card_expiry_month' | 'card_expiry_year'>, now = new Date()): boolean {
  if (!m.card_expiry_month || !m.card_expiry_year) return false;
  const year = m.card_expiry_year < 100 ? 2000 + m.card_expiry_year : m.card_expiry_year;
  // A card is valid through the END of its expiry month.
  return new Date(year, m.card_expiry_month, 1).getTime() <= now.getTime();
}
