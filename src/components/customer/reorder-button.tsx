'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { CART_KEY } from '@/hooks/use-cart';
import { cartApi } from '@/lib/api/cart';
import type { Order } from '@/lib/api/orders';
import { parseError } from '@/lib/errors';
import { reorder, type ReorderResult } from '@/lib/reorder';

function ResultDialog({ result, restaurant, onGoToCart, onClose }: { result: ReorderResult; restaurant: string; onGoToCart: () => void; onClose: () => void }) {
  const titleId = useId();
  const none = result.added === 0;
  return (
    <Modal onClose={onClose} labelledBy={titleId} size="sm">
      <div className="sv-modal-body" style={{ padding: 22 }}>
        <h2 id={titleId} className="sv-modal-title" style={{ fontSize: 19 }}>
          {none ? 'Nothing could be added' : `Added ${result.added} ${result.added === 1 ? 'item' : 'items'} to your cart`}
        </h2>
        <p style={{ color: 'var(--fg-2)' }}>
          {none ? `None of these dishes from ${restaurant} can be ordered right now:` : 'Some dishes couldn’t be added because the menu has changed:'}
        </p>
        <ul className="sv-skip-list">
          {result.skipped.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              <span>{s.reason}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="sv-modal-foot">
        <Button variant="ghost" onClick={onClose}>{none ? 'Close' : 'Stay here'}</Button>
        {!none && <Button onClick={onGoToCart}>Go to cart</Button>}
      </div>
    </Modal>
  );
}

/**
 * "Order again": rebuilds the cart from a past order using today's menu. There is no reorder endpoint, so each line
 * is matched against the current menu and added through the normal cart API. Dishes that changed are reported.
 */
export function ReorderButton({ order, className = 'btn btn-primary', label = 'Order again' }: { order: Order; className?: string; label?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [conflictWith, setConflictWith] = useState<string | null>(null);
  const [result, setResult] = useState<ReorderResult | null>(null);

  const unavailable = !order.restaurant || order.items.length === 0;

  async function run(replace: boolean) {
    setBusy(true);
    setProgress(null);
    try {
      const current = await cartApi.get();
      const otherRestaurant = current.items.length > 0 && !!current.restaurant && current.restaurant !== order.restaurant;
      if (otherRestaurant && !replace) {
        setConflictWith(current.restaurant_name ?? 'another restaurant');
        return;
      }
      if (otherRestaurant) await cartApi.clear(current);
      setConflictWith(null);

      const outcome = await reorder(order, (done, total) => setProgress(`Adding ${Math.min(done + 1, total)} of ${total}…`));
      // Cleared and/or filled: either way the cached cart is stale.
      if (outcome.cart) queryClient.setQueryData(CART_KEY, outcome.cart);
      else void queryClient.invalidateQueries({ queryKey: CART_KEY });

      if (outcome.skipped.length > 0) setResult(outcome);
      else {
        push(`Added ${outcome.added} ${outcome.added === 1 ? 'item' : 'items'} from ${order.restaurant_name}.`);
        router.push('/customer/cart');
      }
    } catch (e) {
      push(parseError(e).display, 'error');
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy || unavailable}
        aria-busy={busy || undefined}
        title={unavailable ? 'This restaurant is no longer available' : undefined}
        onClick={() => run(false)}
      >
        {busy ? (progress ?? 'Preparing…') : label}
      </button>

      {conflictWith && (
        <ConfirmDialog
          title="Start a new cart?"
          message={`Your cart already has items from ${conflictWith}. A cart can only hold one restaurant’s food, so ordering again from ${order.restaurant_name} will empty it first.`}
          confirmLabel="Start new cart"
          busy={busy}
          onConfirm={() => run(true)}
          onClose={() => !busy && setConflictWith(null)}
        />
      )}
      {result && (
        <ResultDialog
          result={result}
          restaurant={order.restaurant_name}
          onClose={() => setResult(null)}
          onGoToCart={() => {
            setResult(null);
            router.push('/customer/cart');
          }}
        />
      )}
    </>
  );
}
