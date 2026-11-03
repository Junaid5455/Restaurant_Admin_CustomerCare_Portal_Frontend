'use client';

import './menu-page.css';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ItemModal } from './item-modal';
import { useCart } from '@/hooks/use-cart';
import { restaurantsApi, type MenuItem } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';

/**
 * The menu inside the Book a table form: guests pick dishes while they book. Each dish opens the usual options
 * dialog and goes into the cart; after booking they review it and place the order for their table.
 */
export function BookingMenu({ restaurantId, name }: { restaurantId: string; name: string }) {
  const q = useQuery({ queryKey: ['restaurant-menu', restaurantId], queryFn: () => restaurantsApi.menu(restaurantId), staleTime: 60_000 });
  const cart = useCart();
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const categories = (q.data ?? [])
    .map((c) => ({ ...c, items: c.items.filter((i) => i.is_available) }))
    .filter((c) => c.items.length > 0);

  // Only count the cart when it belongs to this restaurant (a cart holds one restaurant at a time).
  const mine = cart.data && cart.data.restaurant === restaurantId ? cart.data : null;
  const count = mine ? mine.items.reduce((n, l) => n + l.quantity, 0) : 0;

  return (
    <details className="mp-preview" open>
      <summary>🍽 Pick your food at {name} (optional)</summary>
      {q.isPending ? (
        <p className="field-hint" role="status">Loading the menu…</p>
      ) : q.isError ? (
        <p className="field-error" role="alert">{parseError(q.error).display}</p>
      ) : categories.length === 0 ? (
        <p className="field-hint">This restaurant hasn’t published its menu yet.</p>
      ) : (
        <>
          <p className="field-hint" style={{ margin: '0 0 8px' }}>Add dishes now. After you book, you review them and place the order for your table.</p>
          <div className="mp-preview-body" tabIndex={0} aria-label={`Menu at ${name}`}>
            {categories.map((c) => (
              <section key={c.id} aria-label={c.name}>
                <h4>{c.name}</h4>
                <ul>
                  {c.items.map((i) => (
                    <li key={i.id}>
                      <span>{i.name}{i.description && <small>{i.description}</small>}</span>
                      <span className="mp-row-end">
                        <span className="mp-price">{formatMoney(i.price)}</span>
                        <button type="button" className="btn btn-ghost mp-add" onClick={() => setSelected(i)} aria-label={`Add ${i.name} to your order`}>+ Add</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mp-preview-foot" aria-live="polite">
            {count > 0 && mine ? (
              <>
                <strong>🛒 {count} {count === 1 ? 'item' : 'items'} chosen · {formatMoney(mine.subtotal)}</strong>
                <Link href="/customer/cart" className="sv-link-btn">View or change</Link>
              </>
            ) : (
              <span className="field-hint">Nothing chosen yet. You can also order after you book.</span>
            )}
          </div>
        </>
      )}
      {selected && <ItemModal key={selected.id} item={selected} restaurant={{ id: restaurantId, name }} onClose={() => setSelected(null)} />}
    </details>
  );
}
