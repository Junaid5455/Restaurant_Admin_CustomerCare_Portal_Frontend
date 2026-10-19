'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { favoritesApi, type FavoriteItem, type FavoriteRestaurant } from '@/lib/api/favorites';
import { parseError } from '@/lib/errors';

export const FAV_RESTAURANTS_KEY = ['favorites', 'restaurants'] as const;
export const FAV_ITEMS_KEY = ['favorites', 'items'] as const;

export function useFavoriteRestaurants() {
  return useQuery({ queryKey: FAV_RESTAURANTS_KEY, queryFn: favoritesApi.restaurants.list, staleTime: 60_000 });
}

export function useFavoriteItems() {
  return useQuery({ queryKey: FAV_ITEMS_KEY, queryFn: favoritesApi.items.list, staleTime: 60_000 });
}

interface Toggle {
  /** False until the favourites list has loaded (or if it can't be loaded, e.g. a non-customer account). */
  ready: boolean;
  failed: boolean;
  isFavorite: boolean;
  busy: boolean;
  toggle: () => Promise<void>;
}

/**
 * Shared add/remove logic. Removing is optimistic (and rolled back by a refetch if it fails); adding waits for
 * the server, because a duplicate POST is a database error on the backend and we'd rather show a spinner.
 */
function useToggle<Row extends { id: string }>(opts: {
  queryKey: QueryKey;
  rows: Row[] | undefined;
  failed: boolean;
  targetOf: (row: Row) => string;
  add: (targetId: string) => Promise<Row>;
  remove: (favoriteId: string) => Promise<void>;
  targetId: string;
  label: string;
}): Toggle {
  const { queryKey, rows, failed, targetOf, add, remove, targetId, label } = opts;
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const row = rows?.find((r) => targetOf(r) === targetId);

  async function toggle() {
    if (!rows || busy) return;
    setBusy(true);
    try {
      if (row) {
        queryClient.setQueryData<Row[]>(queryKey, (old) => old?.filter((r) => r.id !== row.id));
        await remove(row.id);
        push(`Removed ${label} from your favorites`, 'info');
      } else {
        const created = await add(targetId);
        queryClient.setQueryData<Row[]>(queryKey, (old) => [created, ...(old ?? []).filter((r) => targetOf(r) !== targetId)]);
        push(`Saved ${label} to your favorites`);
      }
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      // Always re-sync: it repairs the optimistic update after a failure and fills in any fields the POST omitted.
      void queryClient.invalidateQueries({ queryKey });
      setBusy(false);
    }
  }

  return { ready: !!rows, failed, isFavorite: !!row, busy, toggle };
}

export function useRestaurantFavorite(restaurantId: string, name: string): Toggle {
  const q = useFavoriteRestaurants();
  return useToggle<FavoriteRestaurant>({
    queryKey: FAV_RESTAURANTS_KEY,
    rows: q.data,
    failed: q.isError && !q.data,
    targetOf: (r) => r.restaurant.id,
    add: favoritesApi.restaurants.add,
    remove: favoritesApi.restaurants.remove,
    targetId: restaurantId,
    label: name,
  });
}

export function useItemFavorite(itemId: string, name: string): Toggle {
  const q = useFavoriteItems();
  return useToggle<FavoriteItem>({
    queryKey: FAV_ITEMS_KEY,
    rows: q.data,
    failed: q.isError && !q.data,
    targetOf: (r) => r.menu_item.id,
    add: favoritesApi.items.add,
    remove: favoritesApi.items.remove,
    targetId: itemId,
    label: name,
  });
}
