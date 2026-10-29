import { useQuery } from '@tanstack/react-query';
import { adminReservationsApi } from '@/lib/api/admin-reservations';

export const RESERVATIONS_KEY = ['admin-reservations'] as const;
export const TABLES_KEY = ['admin-tables'] as const;

export const useReservations = () =>
  useQuery({ queryKey: RESERVATIONS_KEY, queryFn: adminReservationsApi.list, retry: false, staleTime: 20_000, refetchOnWindowFocus: true, refetchInterval: 45_000 });

export const useTables = () => useQuery({ queryKey: TABLES_KEY, queryFn: adminReservationsApi.tables, retry: false, staleTime: 30_000, refetchOnWindowFocus: true });
