import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';
import type { CartItem, OrderType } from './cart';
import type { Order, OrderStatus, PaymentStatus } from './orders';

/**
 * The payment attached to an order. The stock OrderSerializer doesn't include it, so every field is optional on
 * `AdminOrder.payment`; see the backend notes delivered with step 7.3.
 */
export interface OrderPayment {
  id: string;
  status: PaymentStatus;
  payment_method: string;
  amount: string;
  currency?: string;
  transaction_id?: string | null;
  paid_at?: string | null;
  refund_amount?: string | null;
  refund_reason?: string | null;
  refunded_at?: string | null;
}

/**
 * An order as the restaurant sees it. Everything beyond `Order` is optional: the stock OrderSerializer omits it,
 * and the views show whatever the API provides rather than guessing.
 */
export interface AdminOrder extends Order {
  items: CartItem[];
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  discount_amount?: string | null;
  coupon_code?: string | null;
  delivery_address?: string | null;
  delivery_city?: string | null;
  delivery_postal_code?: string | null;
  delivery_instructions?: string | null;
  pickup_time?: string | null;
  table_number?: string | null;
  number_of_guests?: number | null;
  customer_notes?: string | null;
  special_instructions?: string | null;
  placed_at?: string | null;
  confirmed_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  payment?: OrderPayment | null;
}

export interface AdminOrderParams {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  order_type?: OrderType;
  payment_status?: PaymentStatus;
}

export interface AdminOrderPage {
  orders: AdminOrder[];
  page: number;
  totalPages: number;
  totalItems: number;
}

interface Envelope {
  data: AdminOrder[];
  meta?: { current_page: number; total_pages: number; total_items: number };
}
interface PlainPage {
  count: number;
  results: AdminOrder[];
}

export const adminOrdersApi = {
  /** The list is wrapped in {success,data,meta}; `call()` would drop `meta`, so read the raw body. */
  async list(params: AdminOrderParams = {}): Promise<AdminOrderPage> {
    const pageSize = params.page_size ?? 15;
    try {
      const res = await api.get('/orders/', { params: { ...params, page_size: pageSize } });
      const body = res.data as Envelope | PlainPage | AdminOrder[];
      if (Array.isArray(body)) return { orders: body, page: 1, totalPages: 1, totalItems: body.length };
      if ('results' in body) {
        return { orders: body.results, page: params.page ?? 1, totalPages: Math.max(1, Math.ceil(body.count / pageSize)), totalItems: body.count };
      }
      return {
        orders: body.data,
        page: body.meta?.current_page ?? params.page ?? 1,
        totalPages: body.meta?.total_pages ?? 1,
        totalItems: body.meta?.total_items ?? body.data.length,
      };
    } catch (e) {
      throw parseError(e);
    }
  },

  get: (id: string) => call<AdminOrder>(() => api.get(`/orders/${id}/`)),

  /** POST /orders/{id}/update-status/ */
  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await call<unknown>(() => api.post(`/orders/${id}/update-status/`, { status }));
  },

  /** POST /orders/{id}/cancel/. Allowed while PLACED or CONFIRMED. */
  async cancel(id: string, reason: string): Promise<void> {
    await call<unknown>(() => api.post(`/orders/${id}/cancel/`, { reason }));
  },

  /**
   * POST /payments/{id}/refund/. The view reads `amount` (defaults to the full amount) and, once the backend
   * patch is applied, `reason`.
   */
  refund: (paymentId: string, amount: number, reason: string) =>
    call<OrderPayment>(() => api.post(`/payments/${paymentId}/refund/`, { amount, reason })),
};
