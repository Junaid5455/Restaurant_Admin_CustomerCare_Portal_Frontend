import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';
import type { CartItem, OrderType } from './cart';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

/** OrderSerializer. It doesn't include the delivery address, pickup time or table, so those come from the checkout snapshot. */
export interface Order {
  id: string;
  order_number: string;
  restaurant: string | null;
  restaurant_name: string;
  customer: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: string;
  tax_amount: string;
  delivery_fee: string;
  total_amount: string;
  items: CartItem[];
  created_at: string;
}

export interface OrderTracking {
  id: string;
  order_number: string;
  restaurant_name: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  placed_at: string;
  estimated_completion_time: string;
  items: { name: string; quantity: number }[];
}

export interface OrderListParams {
  page?: number;
  page_size?: number;
  status?: OrderStatus;
  order_type?: OrderType;
}

export interface OrderPage {
  orders: Order[];
  page: number;
  totalPages: number;
  totalItems: number;
}

interface Envelope {
  data: Order[];
  meta?: { current_page: number; total_pages: number; total_items: number };
}
interface PlainPage {
  count: number;
  results: Order[];
}

export const ordersApi = {
  /**
   * The order list uses the {success,data,meta} pagination envelope. `call()` would strip `meta`, which the
   * pager needs, so this reads the raw body (and tolerates plain DRF pages too).
   */
  async list(params: OrderListParams = {}): Promise<OrderPage> {
    const pageSize = params.page_size ?? 10;
    try {
      const res = await api.get('/orders/', { params: { ...params, page_size: pageSize } });
      const body = res.data as Envelope | PlainPage | Order[];
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

  get: (id: string) => call<Order>(() => api.get(`/orders/${id}/`)),
  track: (id: string) => call<OrderTracking>(() => api.get(`/orders/${id}/track/`)),
  /** Allowed while the order is PLACED or CONFIRMED. */
  async cancel(id: string, reason = 'Cancelled by customer'): Promise<void> {
    await call<unknown>(() => api.post(`/orders/${id}/cancel/`, { reason }));
  },
};
