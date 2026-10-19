import { api } from '../http';
import { call } from './call';
import type { MenuItem, RestaurantSummary } from './restaurants';

/** GET /users/favorites/restaurants/: `restaurant` is a RestaurantListSerializer. */
export interface FavoriteRestaurant {
  id: string;
  restaurant: RestaurantSummary;
  created_at: string;
}

/**
 * GET /users/favorites/items/: `menu_item` is a MenuItemSerializer. It carries no restaurant id or name,
 * so a favourite dish can't link back to its restaurant until the serializer adds one.
 */
export interface FavoriteItem {
  id: string;
  menu_item: MenuItem;
  created_at: string;
}

type Maybe<T> = T[] | { results: T[] };

async function listOf<T>(path: string): Promise<T[]> {
  const res = await call<Maybe<T>>(() => api.get(path, { params: { page_size: 100 } }));
  return Array.isArray(res) ? res : res.results;
}

/** The ids in these URLs are the FAVOURITE row ids, not the restaurant / dish ids. */
export const favoritesApi = {
  restaurants: {
    list: () => listOf<FavoriteRestaurant>('/users/favorites/restaurants/'),
    add: (restaurantId: string) =>
      call<FavoriteRestaurant>(() => api.post('/users/favorites/restaurants/', { restaurant_id: restaurantId })),
    async remove(favoriteId: string): Promise<void> {
      await call<unknown>(() => api.delete(`/users/favorites/restaurants/${favoriteId}/`));
    },
  },
  items: {
    list: () => listOf<FavoriteItem>('/users/favorites/items/'),
    add: (menuItemId: string) =>
      call<FavoriteItem>(() => api.post('/users/favorites/items/', { menu_item_id: menuItemId })),
    async remove(favoriteId: string): Promise<void> {
      await call<unknown>(() => api.delete(`/users/favorites/items/${favoriteId}/`));
    },
  },
};
