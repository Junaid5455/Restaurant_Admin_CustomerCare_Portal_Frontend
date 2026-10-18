import type { OrderType } from './api/cart';

/**
 * The order API doesn't echo the delivery address, pickup time or table back, so the checkout step keeps a
 * small per-order snapshot in sessionStorage for the payment and confirmation pages. It is only a display aid:
 * every page works (with less detail) when it is missing, and storage can throw in private windows.
 */
export interface CheckoutSnapshot {
  orderType: OrderType;
  pickupTime?: string;
  tableNumber?: string;
  guests?: number;
  address?: string;
  deliveryInstructions?: string;
  /** Payment row created for this order. The API allows only one per order, so we never create a second. */
  paymentId?: string;
}

const KEY = 'savoria-checkout';

function readAll(): Record<string, CheckoutSnapshot> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, CheckoutSnapshot>;
  } catch {
    return {};
  }
}

export function getSnapshot(orderId: string): CheckoutSnapshot | null {
  return readAll()[orderId] ?? null;
}

export function saveSnapshot(orderId: string, patch: Partial<CheckoutSnapshot> & { orderType?: OrderType }) {
  try {
    const all = readAll();
    const next = { ...(all[orderId] ?? {}), ...patch } as CheckoutSnapshot;
    // Keep the store small: remember only the most recent few orders.
    const entries = Object.entries({ ...all, [orderId]: next }).slice(-8);
    sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* storage unavailable: the pages fall back to showing less detail */
  }
}
