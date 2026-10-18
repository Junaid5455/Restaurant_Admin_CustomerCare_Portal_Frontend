import { api } from '../http';
import { call } from './call';
import type { PaymentStatus } from './orders';

export type PayMethod = 'CREDIT_CARD' | 'CASH_ON_DELIVERY' | 'CASH_AT_RESTAURANT';

export interface Payment {
  id: string;
  order: string;
  order_number: string;
  payment_method: string;
  payment_gateway: string;
  transaction_id: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Cash returns the Payment itself; card returns the Payment plus the Stripe client secret. */
export type ProcessResult = Payment | { payment: Payment; client_secret: string };

export const paymentsApi = {
  process: (orderId: string, method: PayMethod) =>
    call<ProcessResult>(() => api.post('/payments/process/', { order_id: orderId, payment_method: method })),

  confirm: (paymentId: string) => call<Payment>(() => api.post('/payments/confirm/', { payment_id: paymentId })),

  get: (paymentId: string) => call<Payment>(() => api.get(`/payments/${paymentId}/`)),
};

export function isCardResult(r: ProcessResult): r is { payment: Payment; client_secret: string } {
  return 'client_secret' in r;
}
