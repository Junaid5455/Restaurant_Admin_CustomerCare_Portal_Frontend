import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';

/* ───────────── Types (verified against apps/restaurants ReservationSerializer, RestaurantTableSerializer and views) ───────────── */

/** /restaurants/reservations/. The owner sees every booking at their restaurant. */
export interface Reservation {
  id: string;
  restaurant: string;
  restaurant_name?: string;
  customer: string;
  customer_email?: string;
  /** Read-only on the serializer: owners can't assign a table through the API yet. */
  table: string | null;
  table_number?: string | null;
  /** ISO date-time. */
  reservation_time: string;
  party_size: number;
  /** PENDING, CONFIRMED and CANCELLED are the ones the views set; the model may define more. */
  status: string;
  special_requests?: string | null;
  created_at: string;
}

/** /restaurants/tables/ (owners only). */
export interface DiningTable {
  id: string;
  table_number: string;
  capacity: number;
  is_active: boolean;
  qr_code_token?: string;
  created_at?: string;
}
export type TableInput = Pick<DiningTable, 'table_number' | 'capacity' | 'is_active'>;

type Maybe<T> = T[] | { results: T[] };
const asList = <T,>(res: Maybe<T>): T[] => (Array.isArray(res) ? res : res.results);

const PAGE = 100;
const MAX_PAGES = 5;

export interface ReservationPage {
  reservations: Reservation[];
  total: number;
}

export const adminReservationsApi = {
  /** Up to 500 bookings, newest first as the server sends them. Reads the raw body so we keep the real total. */
  async list(): Promise<ReservationPage> {
    try {
      let all: Reservation[] = [];
      let total = 0;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await api.get('/restaurants/reservations/', { params: { page, page_size: PAGE } });
        const body = res.data as { data?: Reservation[]; results?: Reservation[]; count?: number; next?: string | null; meta?: { has_next?: boolean; total_items?: number } } | Reservation[];
        if (Array.isArray(body)) return { reservations: body, total: body.length };
        const rows = body.data ?? body.results ?? [];
        all = all.concat(rows);
        total = body.meta?.total_items ?? body.count ?? all.length;
        const more = body.meta ? !!body.meta.has_next : !!body.next;
        if (!more) break;
      }
      return { reservations: all, total };
    } catch (e) {
      throw parseError(e);
    }
  },

  confirm: (id: string) => call<Reservation>(() => api.post(`/restaurants/reservations/${id}/confirm/`)),

  async cancel(id: string): Promise<void> {
    await call<unknown>(() => api.post(`/restaurants/reservations/${id}/cancel/`));
  },

  async tables(): Promise<DiningTable[]> {
    const res = await call<Maybe<DiningTable>>(() => api.get('/restaurants/tables/', { params: { page_size: 100 } }));
    return asList(res);
  },
  addTable: (t: TableInput) => call<DiningTable>(() => api.post('/restaurants/tables/', t)),
  updateTable: (id: string, t: Partial<TableInput>) => call<DiningTable>(() => api.patch(`/restaurants/tables/${id}/`, t)),
  async removeTable(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/restaurants/tables/${id}/`));
  },
};
