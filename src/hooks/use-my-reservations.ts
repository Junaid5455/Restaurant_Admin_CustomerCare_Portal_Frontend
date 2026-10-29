import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '@/lib/api/reservations';
import { restaurantsApi, type RestaurantSummary } from '@/lib/api/restaurants';

export const MY_RESERVATIONS_KEY = ['my-reservations'] as const;

export const useMyReservations = () =>
  useQuery({ queryKey: MY_RESERVATIONS_KEY, queryFn: reservationsApi.list, retry: false, staleTime: 20_000, refetchOnWindowFocus: true, refetchInterval: 60_000 });

/** Every restaurant a guest can pick when booking, by name. The list is paged (20 at a time), so follow it to the end. */
export const useBookableRestaurants = () =>
  useQuery({
    queryKey: ['booking-restaurants'],
    queryFn: async () => {
      const out: RestaurantSummary[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await restaurantsApi.list({ ordering: 'name', page });
        out.push(...res.results);
        if (!res.next) break;
      }
      return out;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

export const useSlots = (restaurantId: string, date: string, partySize: number) =>
  useQuery({
    queryKey: ['reservation-slots', restaurantId, date, partySize],
    queryFn: () => reservationsApi.slots(restaurantId, date, partySize),
    enabled: !!restaurantId && !!date,
    retry: false,
    staleTime: 15_000,
  });
