'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CartLine, ConfirmDialog } from './cart-line';
import { CheckoutSteps } from './checkout-steps';
import { OrderSummary } from './order-summary';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/components/ui/toast';
import { CART_KEY, useCart } from '@/hooks/use-cart';
import { cartApi, cartCount, type CartItem } from '@/lib/api/cart';
import { restaurantsApi } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';
import { formatMoney, isOpenNow, toNumber } from '@/lib/format';

export function CartView() {
  const cart = useCart();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const restaurantId = cart.data?.restaurant ?? null;
  const restaurant = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => restaurantsApi.get(restaurantId as string),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });

  async function withLine(line: CartItem, work: () => Promise<unknown>) {
    setBusyIds((ids) => [...ids, line.id]);
    try {
      const updated = await work();
      queryClient.setQueryData(CART_KEY, updated);
    } catch (e) {
      push(parseError(e).display, 'error');
      // The cart may have changed server-side (e.g. the replacement line was added); resync.
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== line.id));
    }
  }

  async function clearCart() {
    if (!cart.data) return;
    setClearing(true);
    try {
      await cartApi.clear(cart.data);
      setConfirmClear(false);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setClearing(false);
      await queryClient.invalidateQueries({ queryKey: CART_KEY });
    }
  }

  if (cart.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading your cart">
        <div className="sv-skel" style={{ height: 34, width: 220, marginBottom: 18 }} />
        <div className="sv-cart-layout">
          <div className="sv-skel" style={{ height: 260 }} />
          <div className="sv-skel" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  if (cart.isError) {
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">⚠️</div>
        <h2>We couldn’t load your cart</h2>
        <p>{parseError(cart.error).display}</p>
        <button type="button" className="btn btn-primary" onClick={() => cart.refetch()}>Try again</button>
      </div>
    );
  }

  const data = cart.data;
  if (data.items.length === 0) {
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Pick a restaurant and add a few dishes to get started.</p>
        <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
      </div>
    );
  }

  const minOrder = toNumber(restaurant.data?.min_order_amount);
  const subtotal = toNumber(data.subtotal);
  const belowMin = minOrder > 0 && subtotal < minOrder;
  const closed = restaurant.data ? !isOpenNow(restaurant.data) : false;
  const anyBusy = busyIds.length > 0 || clearing;

  return (
    <div>
      <CheckoutSteps current={0} />

      <div className="sv-page-head" style={{ marginTop: 18 }}>
        <h1>Your cart</h1>
        <p>
          {cartCount(data)} {cartCount(data) === 1 ? 'item' : 'items'} from{' '}
          {restaurantId ? (
            <Link href={`/customer/restaurants/${restaurantId}`} className="link">{data.restaurant_name ?? 'the restaurant'}</Link>
          ) : (
            'the restaurant'
          )}
        </p>
      </div>

      {closed && (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="info">
            {data.restaurant_name ?? 'This restaurant'} looks closed right now. You can still place your order, but it may not be prepared until they open.
          </Alert>
        </div>
      )}

      <div className="sv-cart-layout">
        <section className="card sv-lines-card" aria-label="Items in your cart">
          <ul className="sv-lines">
            {data.items.map((line) => (
              <CartLine
                key={line.id}
                line={line}
                busy={busyIds.includes(line.id) || clearing}
                onQuantity={(qty) => withLine(line, () => cartApi.setQuantity(line, qty))}
                onRemove={() => withLine(line, () => cartApi.removeItem(line.id))}
              />
            ))}
          </ul>
          <div className="sv-lines-foot">
            {restaurantId && (
              <Link href={`/customer/restaurants/${restaurantId}`} className="link">+ Add more items</Link>
            )}
            <button type="button" className="sv-link-btn" disabled={anyBusy} onClick={() => setConfirmClear(true)}>
              Clear cart
            </button>
          </div>
        </section>

        <aside className="sv-cart-aside">
          <OrderSummary subtotal={data.subtotal} tax={data.tax_amount} deliveryFee={null} total={data.total_amount}>
            <p className="sv-summary-note">Delivery fee is added if you choose delivery in the next step.</p>
          </OrderSummary>

          {belowMin && (
            <Alert kind="info">
              {data.restaurant_name ?? 'This restaurant'} has a minimum order of {formatMoney(minOrder)}. Add {formatMoney(minOrder - subtotal)} more to continue.
            </Alert>
          )}

          {belowMin || anyBusy ? (
            <button type="button" className="btn btn-primary btn-block" disabled>
              Continue to checkout
            </button>
          ) : (
            <Link href="/customer/checkout" className="btn btn-primary btn-block">
              Continue to checkout
            </Link>
          )}
        </aside>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear your cart?"
          message={`This removes all ${cartCount(data)} ${cartCount(data) === 1 ? 'item' : 'items'} from your cart.`}
          confirmLabel="Clear cart"
          busy={clearing}
          onConfirm={clearCart}
          onClose={() => !clearing && setConfirmClear(false)}
        />
      )}
    </div>
  );
}
