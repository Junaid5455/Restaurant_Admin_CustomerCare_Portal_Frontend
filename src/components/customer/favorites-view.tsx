'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AccountShell, SectionSkeleton } from './account-shell';
import { ItemHeart } from './favorite-button';
import { ItemModal } from './item-modal';
import { RestaurantCard, RestaurantCardSkeleton } from './restaurant-card';
import { Alert } from '@/components/ui/alert';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/submit-button';
import { useFavoriteItems, useFavoriteRestaurants } from '@/hooks/use-favorites';
import type { MenuItem } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';
import { formatMoney, toNumber } from '@/lib/format';

type Tab = 'restaurants' | 'items';

function RestaurantsTab() {
  const q = useFavoriteRestaurants();

  if (q.isPending) {
    return (
      <div className="sv-grid" aria-busy="true" aria-label="Loading favorite restaurants">
        {Array.from({ length: 3 }, (_, i) => <RestaurantCardSkeleton key={i} />)}
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <div className="sv-acct-inline">
        <Alert>{parseError(q.error).display}</Alert>
        <Button variant="ghost" onClick={() => q.refetch()}>Try again</Button>
      </div>
    );
  }
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">🍽</div>
        <h2>No favorite restaurants yet</h2>
        <p>Tap the ♡ on any restaurant to keep it here for next time.</p>
        <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
      </div>
    );
  }
  return (
    <div className="sv-grid">
      {rows.map((f) => <RestaurantCard key={f.id} restaurant={f.restaurant} />)}
    </div>
  );
}

function FavoriteItemCard({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) {
  const hasRating = item.review_count > 0 && toNumber(item.rating) > 0;
  const unavailable = !item.is_available;
  return (
    <li className={`card sv-fav-item ${unavailable ? 'off' : ''}`}>
      <div className="sv-fav-media">
        <SafeImage src={item.image} alt="" fallback={<span aria-hidden="true">🍴</span>} />
      </div>
      <div className="sv-fav-body">
        <div className="sv-fav-top">
          <h2>{item.name}</h2>
          <ItemHeart itemId={item.id} name={item.name} />
        </div>
        {item.description && <p className="sv-fav-desc">{item.description}</p>}
        <div className="sv-fav-foot">
          <span className="sv-price">{formatMoney(item.price)}</span>
          <span>⏱ {item.prep_time} min</span>
          {hasRating && <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>★ {toNumber(item.rating).toFixed(1)}</span>}
          {unavailable && <span className="badge badge-warn">Unavailable</span>}
        </div>
        <Button variant="ghost" disabled={unavailable} onClick={() => onAdd(item)} aria-label={`Add to cart: ${item.name}`}>
          {unavailable ? 'Not available right now' : 'Add to cart'}
        </Button>
      </div>
    </li>
  );
}

function ItemsTab() {
  const q = useFavoriteItems();
  const [selected, setSelected] = useState<MenuItem | null>(null);

  if (q.isPending) return <SectionSkeleton rows={3} height={130} />;
  if (q.isError && !q.data) {
    return (
      <div className="sv-acct-inline">
        <Alert>{parseError(q.error).display}</Alert>
        <Button variant="ghost" onClick={() => q.refetch()}>Try again</Button>
      </div>
    );
  }
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">🍴</div>
        <h2>No favorite dishes yet</h2>
        <p>Open any dish on a menu and tap the ♡ to save it here.</p>
        <Link href="/customer/restaurants" className="btn btn-primary">Browse menus</Link>
      </div>
    );
  }
  return (
    <>
      <ul className="sv-acct-list sv-fav-grid">
        {rows.map((f) => <FavoriteItemCard key={f.id} item={f.menu_item} onAdd={setSelected} />)}
      </ul>
      {selected && <ItemModal key={selected.id} item={selected} restaurant={null} onClose={() => setSelected(null)} />}
    </>
  );
}

export function FavoritesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get('tab') === 'items' ? 'items' : 'restaurants';
  const restaurants = useFavoriteRestaurants();
  const items = useFavoriteItems();

  function go(next: Tab) {
    router.replace(next === 'restaurants' ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  }

  return (
    <AccountShell active="favorites" title="Favorites" description="Your saved restaurants and dishes, one tap away.">
      <div className="sv-seg" role="tablist" aria-label="Favorites">
        {(['restaurants', 'items'] as const).map((t) => {
          const count = (t === 'restaurants' ? restaurants.data : items.data)?.length;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`fav-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="fav-panel"
              className={tab === t ? 'active' : ''}
              onClick={() => go(t)}
            >
              {t === 'restaurants' ? 'Restaurants' : 'Dishes'}
              {count !== undefined && <span className="count">{count}</span>}
            </button>
          );
        })}
      </div>
      <div id="fav-panel" role="tabpanel" aria-labelledby={`fav-tab-${tab}`}>
        {tab === 'restaurants' ? <RestaurantsTab /> : <ItemsTab />}
      </div>
    </AccountShell>
  );
}
