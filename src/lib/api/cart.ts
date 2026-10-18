import { api } from '../http';
import { ApiError } from '../errors';
import { call } from './call';
import { restaurantsApi } from './restaurants';

export interface CartItem {
  id: string;
  menu_item: string | null;
  item_name: string;
  /** Unit price: base price plus selected option modifiers and add-ons. */
  item_price: string;
  quantity: number;
  subtotal: string;
  special_instructions?: string | null;
  customizations: { id: string; customization_name: string; option_name: string; price_modifier: string }[];
  add_ons: { id: string; addon_name: string; addon_price: string }[];
}

export interface Cart {
  id: string;
  order_number: string;
  restaurant: string | null;
  /** Omitted by the API while the cart has no restaurant. */
  restaurant_name?: string;
  order_type: string;
  status: string;
  subtotal: string;
  tax_amount: string;
  delivery_fee: string;
  total_amount: string;
  items: CartItem[];
  created_at: string;
}

export interface AddToCartInput {
  menu_item_id: string;
  quantity: number;
  special_instructions?: string;
  customization_option_ids?: string[];
  addon_ids?: string[];
}

export type OrderType = 'PICKUP' | 'DELIVERY' | 'DINE_IN';

export interface CheckoutInput {
  order_type: OrderType;
  /** DELIVERY */
  address_id?: string;
  delivery_instructions?: string;
  /** PICKUP: ISO date-time */
  pickup_time?: string;
  /** DINE_IN */
  table_number?: string;
  number_of_guests?: number;
}

export interface CheckoutResult {
  message: string;
  order_id: string;
  order_type: OrderType;
  total_amount: string;
}

/**
 * The backend routes PATCH and DELETE for /cart/items/{id}/ through two @actions with the same url_path, and
 * DRF's router lets the first one (remove_item) swallow both, so PATCH answers 405. Until that is fixed on the
 * server, changing a quantity falls back to "add the same line again with the new quantity, then drop the old one".
 * Adding first means a failure never loses the item.
 */
async function rebuildLine(line: CartItem, quantity: number): Promise<Cart> {
  if (!line.menu_item) {
    throw new ApiError('This dish is no longer on the menu. Remove it and add it again if you still want it.');
  }
  const detail = await restaurantsApi.item(line.menu_item);

  const optionIds: string[] = [];
  for (const picked of line.customizations) {
    const group = detail.customizations.find((c) => c.name === picked.customization_name);
    const option = group?.options.find((o) => o.name === picked.option_name);
    if (!option) throw new ApiError(`“${picked.option_name}” is no longer offered. Remove this item and add it again.`);
    optionIds.push(option.id);
  }
  const addonIds: string[] = [];
  for (const picked of line.add_ons) {
    const addon = detail.add_ons.find((a) => a.name === picked.addon_name && a.is_available);
    if (!addon) throw new ApiError(`“${picked.addon_name}” is no longer available. Remove this item and add it again.`);
    addonIds.push(addon.id);
  }

  await cartApi.add({
    menu_item_id: line.menu_item,
    quantity,
    customization_option_ids: optionIds,
    addon_ids: addonIds,
    ...(line.special_instructions ? { special_instructions: line.special_instructions } : {}),
  });
  return cartApi.removeItem(line.id);
}

export const cartApi = {
  get: () => call<Cart>(() => api.get('/orders/cart/')),

  add: (input: AddToCartInput) => call<Cart>(() => api.post('/orders/cart/items/', input)),

  removeItem: (itemId: string) => call<Cart>(() => api.delete(`/orders/cart/items/${itemId}/`)),

  async setQuantity(line: CartItem, quantity: number): Promise<Cart> {
    try {
      return await call<Cart>(() => api.patch(`/orders/cart/items/${line.id}/`, { quantity }));
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 405) throw e;
    }
    return rebuildLine(line, quantity);
  },

  /** There is no "clear cart" endpoint, so remove the lines one by one. */
  async clear(cart: Cart) {
    for (const item of cart.items) {
      await cartApi.removeItem(item.id);
    }
  },

  /** Turns the cart into a placed order. The response is a small summary, not the full order. */
  checkout: (input: CheckoutInput) => call<CheckoutResult>(() => api.post('/orders/cart/checkout/', input)),
};

export function cartCount(cart: Cart | undefined): number {
  return cart ? cart.items.reduce((n, i) => n + i.quantity, 0) : 0;
}
