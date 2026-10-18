import { api } from '../http';
import { call } from './call';

export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

/** DeliverySerializer (the customer-visible subset). */
export interface Delivery {
  id: string;
  order: string;
  status: DeliveryStatus;
  driver: string | null;
  estimated_delivery_time_minutes: number | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  current_latitude: string | null;
  current_longitude: string | null;
  last_location_update: string | null;
}

type Maybe<T> = T[] | { results: T[] };

export const deliveryApi = {
  /**
   * Customers can list their own deliveries but the endpoint has no `order` filter, so fetch them and pick ours.
   * A delivery row only exists once the restaurant has started dispatching, so `null` is normal early on.
   */
  async forOrder(orderId: string): Promise<Delivery | null> {
    const res = await call<Maybe<Delivery>>(() => api.get('/delivery/', { params: { page_size: 100 } }));
    const list = Array.isArray(res) ? res : res.results;
    return list.find((d) => d.order === orderId) ?? null;
  },
};
