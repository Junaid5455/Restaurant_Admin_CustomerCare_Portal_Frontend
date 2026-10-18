import { cartApi, type AddToCartInput, type Cart, type CartItem } from './api/cart';
import type { Order } from './api/orders';
import { restaurantsApi } from './api/restaurants';
import { ApiError, parseError } from './errors';

export interface ReorderSkip {
  name: string;
  reason: string;
}

export interface ReorderResult {
  added: number;
  skipped: ReorderSkip[];
  /** The cart after the last successful add, or null if nothing was added. */
  cart: Cart | null;
}

/**
 * Turns one past order line into an add-to-cart request against TODAY's menu. The order only stored option and
 * add-on names, so they are matched by name; anything renamed, removed or unavailable makes the line skip with
 * a reason rather than silently ordering something different.
 */
async function resolveLine(line: CartItem): Promise<AddToCartInput> {
  if (!line.menu_item) throw new ApiError('No longer on the menu.');

  let detail;
  try {
    detail = await restaurantsApi.item(line.menu_item);
  } catch (e) {
    const err = parseError(e);
    throw new ApiError(err.status === 404 ? 'No longer on the menu.' : err.display);
  }
  if (!detail.is_available) throw new ApiError('Currently unavailable.');

  const optionIds: string[] = [];
  const groupsCovered = new Set<string>();
  for (const picked of line.customizations) {
    const group = detail.customizations.find((c) => c.name === picked.customization_name);
    const option = group?.options.find((o) => o.name === picked.option_name);
    if (!group || !option) throw new ApiError(`“${picked.option_name}” is no longer offered.`);
    optionIds.push(option.id);
    groupsCovered.add(group.id);
  }

  // A choice that became mandatory after the original order can't be guessed.
  const newRequired = detail.customizations.find((c) => c.is_required && c.type !== 'TEXT_INPUT' && !groupsCovered.has(c.id));
  if (newRequired) throw new ApiError(`Now needs a “${newRequired.name}” choice. Add it from the menu.`);

  const addonIds: string[] = [];
  for (const picked of line.add_ons) {
    const addon = detail.add_ons.find((a) => a.name === picked.addon_name);
    if (!addon || !addon.is_available) throw new ApiError(`“${picked.addon_name}” is no longer available.`);
    addonIds.push(addon.id);
  }

  return {
    menu_item_id: detail.id,
    quantity: line.quantity,
    customization_option_ids: optionIds,
    addon_ids: addonIds,
    ...(line.special_instructions ? { special_instructions: line.special_instructions } : {}),
  };
}

/** Re-adds every line of a past order, one at a time (the cart API is not safe to call in parallel). */
export async function reorder(order: Order, onProgress?: (done: number, total: number) => void): Promise<ReorderResult> {
  const skipped: ReorderSkip[] = [];
  let cart: Cart | null = null;
  let added = 0;

  for (const [i, line] of order.items.entries()) {
    onProgress?.(i, order.items.length);
    try {
      cart = await cartApi.add(await resolveLine(line));
      added += 1;
    } catch (e) {
      skipped.push({ name: line.item_name, reason: e instanceof ApiError ? e.display : e instanceof Error ? e.message : 'Could not be added.' });
    }
  }
  onProgress?.(order.items.length, order.items.length);
  return { added, skipped, cart };
}
