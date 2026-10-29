import { api } from '../http';
import { call } from './call';
import { adminReservationsApi, type Reservation, type ReservationPage } from './admin-reservations';

export type { Reservation, ReservationPage };

/** One bookable start time from GET /restaurants/reservations/available-slots/. */
export interface Slot {
  /** ISO date-time. */
  time: string;
  is_available: boolean;
  /** Why it can't be booked ("That time is fully booked."). Empty when available. */
  reason?: string;
}

export interface BookingInput {
  restaurant: string;
  /** ISO date-time of the chosen slot. */
  reservation_time: string;
  party_size: number;
  special_requests?: string;
}

/** The guest's own bookings. The server only returns the signed-in guest's reservations. */
export const reservationsApi = {
  list: (): Promise<ReservationPage> => adminReservationsApi.list(),

  slots: (restaurantId: string, date: string, partySize: number) =>
    call<Slot[]>(() => api.get('/restaurants/reservations/available-slots/', { params: { restaurant_id: restaurantId, date, party_size: partySize } })),

  create: (input: BookingInput) => call<Reservation>(() => api.post('/restaurants/reservations/', input)),

  async cancel(id: string): Promise<void> {
    await call<unknown>(() => api.post(`/restaurants/reservations/${id}/cancel/`));
  },
};
