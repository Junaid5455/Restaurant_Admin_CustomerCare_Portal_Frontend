import { api } from '../http';
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

export const ordersApi = {
  get: (id: string) => call<Order>(() => api.get(`/orders/${id}/`)),
  track: (id: string) => call<OrderTracking>(() => api.get(`/orders/${id}/track/`)),
  /** Allowed while the order is PLACED or CONFIRMED. */
  async cancel(id: string, reason = 'Cancelled by customer'): Promise<void> {
    await call<unknown>(() => api.post(`/orders/${id}/cancel/`, { reason }));
  },
};
