import { useQuery } from '@tanstack/react-query';
import { cartApi } from '@/lib/api/cart';

export const CART_KEY = ['cart'] as const;

/** The customer's active cart (an Order with status CART). Shared by the topbar badge and the item modal. */
export function useCart() {
  return useQuery({ queryKey: CART_KEY, queryFn: cartApi.get, staleTime: 15_000 });
}
