import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';
import type { DeliveryStatus } from './delivery';

export type { DeliveryStatus };

/**
 * DeliverySerializer as the restaurant sees it. `driver` is a RestaurantStaffMember id (the same id the staff
 * pages use) and `driver_name` is that person's email; the serializer leaves `driver_name` out while nobody is assigned.
 */
export interface AdminDelivery {
  id: string;
  order: string;
  order_number: string;
  customer_email?: string | null;
  restaurant: string;
  restaurant_name?: string | null;
  driver: string | null;
  driver_name?: string | null;
  status: DeliveryStatus;
  pickup_address?: string | null;
  delivery_address?: string | null;
  delivery_instructions?: string | null;
  estimated_delivery_time_minutes: number | null;
  actual_delivery_time_minutes: number | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  current_latitude: string | null;
  current_longitude: string | null;
  last_location_update: string | null;
  delivery_rating: string | null;
  created_at: string;
}

interface Envelope {
  data: AdminDelivery[];
  meta?: { has_next?: boolean; total_pages?: number };
}
interface Plain {
  results: AdminDelivery[];
  next?: string | null;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

export const adminDeliveryApi = {
  /** Every delivery the signed-in person may see (the API scopes it by role), newest first, up to 500. */
  async list(): Promise<{ rows: AdminDelivery[]; complete: boolean }> {
    let rows: AdminDelivery[] = [];
    let complete = true;
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await api.get('/delivery/', { params: { page, page_size: PAGE_SIZE } });
        const body = res.data as Envelope | Plain | AdminDelivery[];
        if (Array.isArray(body)) return { rows: body, complete: true };
        if ('results' in body) {
          rows = rows.concat(body.results);
          if (!body.next) return { rows, complete: true };
        } else {
          rows = rows.concat(body.data);
          const more = body.meta?.has_next ?? (body.meta?.total_pages ?? 1) > page;
          if (!more) return { rows, complete: true };
        }
        complete = false;
      }
    } catch (e) {
      throw parseError(e);
    }
    return { rows, complete };
  },

  get: (id: string) => call<AdminDelivery>(() => api.get(`/delivery/${id}/`)),

  /** POST /delivery/{id}/assign-driver/ (owner only). `driverId` is a staff member id. */
  assignDriver: (id: string, driverId: string) => call<AdminDelivery>(() => api.post(`/delivery/${id}/assign-driver/`, { driver_id: driverId })),

  /** Driver-only on the stock backend: an owner account gets 403. */
  markPickedUp: (id: string) => call<AdminDelivery>(() => api.post(`/delivery/${id}/mark-picked-up/`)),
  markDelivered: (id: string) => call<AdminDelivery>(() => api.post(`/delivery/${id}/mark-delivered/`)),

  /** Driver-only, and only for the driver assigned to that delivery. */
  async updateLocation(id: string, latitude: number, longitude: number): Promise<void> {
    await call<unknown>(() => api.post(`/delivery/${id}/update-location/`, { latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
  },
};
