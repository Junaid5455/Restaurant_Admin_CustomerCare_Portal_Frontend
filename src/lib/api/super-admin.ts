import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';
import type { Ticket } from './support';

/**
 * /api/v1/admin/* (apps.common SuperAdminViewSet). The dashboard shape is known; the user, restaurant and order
 * serializers weren't available, so every field beyond the id and the flag the toggles use is optional and the
 * pages show "—" for anything the API doesn't send.
 */
export interface PlatformSummary {
  /** Delivered orders only, as a decimal string. */
  total_revenue: string;
  /** Every order that isn't a cart, whatever its status. */
  total_orders: number;
  active_restaurants: number;
  total_customers: number;
  open_support_tickets: number;
}

export interface PlatformUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
  is_active: boolean;
  date_joined?: string | null;
  last_login?: string | null;
}

export interface PlatformRestaurant {
  id: string;
  name: string;
  owner_email?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  rating?: string | number | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface PlatformOrder {
  id: string;
  order_number?: string | null;
  restaurant?: string | null;
  restaurant_name?: string | null;
  customer_email?: string | null;
  order_type?: string | null;
  status?: string | null;
  total_amount?: string | number | null;
  placed_at?: string | null;
  created_at?: string | null;
}

/** The views return a bare list; accept the paginated shapes too in case a serializer or middleware wraps it. */
function rows<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object') {
    const o = body as { results?: T[]; data?: T[] };
    if (Array.isArray(o.results)) return o.results;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

const TICKET_PAGE = 100;
const TICKET_PAGES = 5;

export const superAdminApi = {
  summary: () => call<PlatformSummary>(() => api.get('/admin/dashboard/')),
  async users(): Promise<PlatformUser[]> {
    return rows<PlatformUser>(await call<unknown>(() => api.get('/admin/users/')));
  },
  async restaurants(): Promise<PlatformRestaurant[]> {
    return rows<PlatformRestaurant>(await call<unknown>(() => api.get('/admin/restaurants/')));
  },
  /** The server returns the latest 50 orders and nothing older. */
  async orders(): Promise<PlatformOrder[]> {
    return rows<PlatformOrder>(await call<unknown>(() => api.get('/admin/orders/')));
  },
  /** Note the path: the action is detail=True on the router root, so the id comes before the action name. */
  toggleUser: (id: string) => call<{ id: string; is_active: boolean }>(() => api.post(`/admin/${id}/toggle-user-active/`)),
  toggleRestaurant: (id: string) => call<{ id: string; is_active: boolean }>(() => api.post(`/admin/${id}/toggle-restaurant-active/`)),

  /** Every ticket on the platform, newest first, up to 500. */
  async tickets(): Promise<{ tickets: Ticket[]; complete: boolean }> {
    let all: Ticket[] = [];
    try {
      for (let page = 1; page <= TICKET_PAGES; page++) {
        const res = await api.get('/support/tickets/', { params: { page, page_size: TICKET_PAGE } });
        const body = res.data as { data?: Ticket[]; results?: Ticket[]; next?: string | null; meta?: { has_next?: boolean; total_pages?: number } } | Ticket[];
        if (Array.isArray(body)) return { tickets: body, complete: true };
        if (body.results) {
          all = all.concat(body.results);
          if (!body.next) return { tickets: all, complete: true };
        } else {
          all = all.concat(body.data ?? []);
          const more = body.meta?.has_next ?? (body.meta?.total_pages ?? 1) > page;
          if (!more) return { tickets: all, complete: true };
        }
      }
    } catch (e) {
      throw parseError(e);
    }
    return { tickets: all, complete: false };
  },

  /** `status` is read-only in the serializer, so priority is the one thing a super admin can change besides closing. */
  setPriority: (id: string, priority: string) => call<Ticket>(() => api.patch(`/support/tickets/${id}/`, { priority })),
};
