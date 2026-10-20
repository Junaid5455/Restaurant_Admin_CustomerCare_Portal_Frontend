import { useQuery } from '@tanstack/react-query';
import { supportApi } from '@/lib/api/support';

export const TICKETS_KEY = ['support-tickets'] as const;
export const ticketKey = (id: string) => ['support-ticket', id] as const;

/** The customer's tickets (newest first, up to 100). Shared by the list page and the order page. */
export function useTickets(opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: TICKETS_KEY,
    queryFn: supportApi.list,
    staleTime: 30_000,
    refetchInterval: opts.poll ? 60_000 : false,
  });
}
