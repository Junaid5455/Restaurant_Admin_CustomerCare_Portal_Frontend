import { api } from '../http';
import { call } from './call';

export interface CartItem {
  id: string;
  menu_item: string | null;
  item_name: string;
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

export const cartApi = {
  get: () => call<Cart>(() => api.get('/orders/cart/')),

  add: (input: AddToCartInput) => call<Cart>(() => api.post('/orders/cart/items/', input)),

  removeItem: (itemId: string) => call<Cart>(() => api.delete(`/orders/cart/items/${itemId}/`)),

  /** There is no "clear cart" endpoint, so remove the lines one by one. */
  async clear(cart: Cart) {
    for (const item of cart.items) {
      await cartApi.removeItem(item.id);
    }
  },
};

export function cartCount(cart: Cart | undefined): number {
  return cart ? cart.items.reduce((n, i) => n + i.quantity, 0) : 0;
}
