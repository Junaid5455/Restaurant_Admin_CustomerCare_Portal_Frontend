import { api } from '../http';
import { call } from './call';

/* ───────────── Types (field names verified against the serializers) ───────────── */

export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  rating: string;
  review_count: number;
  is_open_now: boolean;
  delivery_time_minutes: number;
  min_order_amount: string;
  /** Not returned by RestaurantListSerializer today. The UI uses them automatically once you add them (see notes). */
  banner?: string | null;
  city?: string;
  description?: string | null;
  delivery_fee?: string;
  opening_time?: string;
  closing_time?: string;
  allows_pickup?: boolean;
  allows_delivery?: boolean;
  allows_dine_in?: boolean;
}

export interface DeliveryZone {
  id: string;
  zone_name: string;
  delivery_fee: string;
  delivery_time_minutes: number;
  postal_codes: string;
  is_active: boolean;
}

export interface RestaurantDetail extends RestaurantSummary {
  banner: string | null;
  description: string | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  opening_time: string;
  closing_time: string;
  delivery_fee: string;
  allows_pickup: boolean;
  allows_delivery: boolean;
  allows_dine_in: boolean;
  is_active: boolean;
  delivery_zones: DeliveryZone[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string | null;
  prep_time: number;
  is_available: boolean;
  is_featured: boolean;
  is_new: boolean;
  rating: string;
  review_count: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  order: number;
  is_active: boolean;
  item_count: number;
  items: MenuItem[];
}

export type CustomizationType = 'SINGLE_SELECT' | 'MULTIPLE_SELECT' | 'TEXT_INPUT';

export interface CustomizationOption {
  id: string;
  name: string;
  price_modifier: string;
  order: number;
}

export interface Customization {
  id: string;
  name: string;
  type: CustomizationType;
  is_required: boolean;
  options: CustomizationOption[];
}

export interface AddOn {
  id: string;
  name: string;
  price: string;
  is_available: boolean;
}

export interface MenuItemDetail extends MenuItem {
  is_spicy: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  calories: number | null;
  customizations: Customization[];
  add_ons: AddOn[];
}

/** DRF PageNumberPagination (the restaurants list sets its own, so it is NOT the {success,data,meta} envelope). */
export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type DietFlag = 'is_vegetarian' | 'is_vegan' | 'is_spicy';

/* ───────────── Calls ───────────── */

export interface RestaurantListParams {
  search?: string;
  ordering?: string;
  allows_delivery?: boolean;
  allows_pickup?: boolean;
  page?: number;
}

export const restaurantsApi = {
  list: (params: RestaurantListParams) =>
    call<Paged<RestaurantSummary>>(() => api.get('/restaurants/', { params })),

  /** Typeahead endpoint. Needs 2+ characters, returns at most 20. */
  search: (q: string) =>
    call<{ restaurants: RestaurantSummary[]; count: number }>(() => api.get('/restaurants/search/', { params: { q } })),

  get: (id: string) => call<RestaurantDetail>(() => api.get(`/restaurants/${id}/`)),

  menu: (id: string) => call<MenuCategory[]>(() => api.get(`/restaurants/${id}/menu/`)),

  item: (id: string) => call<MenuItemDetail>(() => api.get(`/menu/items/${id}/`)),

  /**
   * The category/menu serializer doesn't include dietary flags, but /menu/items/ can filter by them
   * server-side, so we fetch the matching item ids and filter the already-loaded menu with them.
   */
  async dietItemIds(restaurantId: string, flag: DietFlag): Promise<string[]> {
    const res = await call<{ id: string }[] | Paged<{ id: string }>>(() =>
      api.get('/menu/items/', { params: { restaurant_id: restaurantId, [flag]: true, page_size: 100 } }),
    );
    const list = Array.isArray(res) ? res : res.results;
    return list.map((i) => i.id);
  },
};
