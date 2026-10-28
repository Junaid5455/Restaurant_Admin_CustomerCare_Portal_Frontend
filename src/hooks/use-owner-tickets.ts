import { useQuery } from '@tanstack/react-query';
import { supportApi } from '@/lib/api/support';

export const OT = {
  list: ['owner-tickets'] as const,
  one: (id: string) => ['owner-ticket', id] as const,
};

/** The tickets the API lets this owner see (only those tied to one of their restaurants), up to 100, newest first. */
export const useOwnerTickets = () =>
  useQuery({ queryKey: OT.list, queryFn: supportApi.list, retry: false, staleTime: 20_000, refetchOnWindowFocus: true, refetchInterval: 45_000 });
