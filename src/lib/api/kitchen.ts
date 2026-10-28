import { api } from '../http';
import { call } from './call';
import type { OrderType } from './cart';

export interface KitchenCustomization {
  customization_name: string;
  option_name: string;
}

export interface KitchenItem {
  id: string;
  item_name: string;
  quantity: number;
  special_instructions?: string | null;
  customizations: KitchenCustomization[];
  add_ons: { addon_name: string }[];
}

export type KitchenStatus = 'CONFIRMED' | 'PREPARING';

/**
 * A ticket on the kitchen screen. The stock KitchenOrderSerializer only returns the fields above `customer_notes`;
 * the rest are optional and light up once the backend adds them (see the step 7.5 notes).
 */
export interface KitchenOrder {
  id: string;
  order_number: string;
  order_type: OrderType;
  table_number: string | null;
  status: KitchenStatus;
  placed_at: string;
  confirmed_at: string | null;
  items: KitchenItem[];
  customer_notes?: string | null;
  special_instructions?: string | null;
  estimated_preparation_time_minutes?: number | null;
}

const clean = (o: KitchenOrder): KitchenOrder => ({
  ...o,
  items: (o.items ?? []).map((i) => ({ ...i, customizations: i.customizations ?? [], add_ons: i.add_ons ?? [] })),
});

export const kitchenApi = {
  /** Orders currently in the kitchen, oldest first. The view isn't paginated, but tolerate a `results` wrapper. */
  async list(): Promise<KitchenOrder[]> {
    const data = await call<KitchenOrder[] | { results: KitchenOrder[] }>(() => api.get('/kitchen/orders/'));
    const rows = Array.isArray(data) ? data : data?.results ?? [];
    return rows.map(clean);
  },
  start: (id: string) => call<KitchenOrder>(() => api.post(`/kitchen/orders/${id}/start/`)),
  ready: (id: string) => call<KitchenOrder>(() => api.post(`/kitchen/orders/${id}/ready/`)),
};
