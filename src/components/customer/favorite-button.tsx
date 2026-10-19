'use client';

import clsx from 'clsx';
import { useItemFavorite, useRestaurantFavorite } from '@/hooks/use-favorites';

interface HeartProps {
  name: string;
  state: { ready: boolean; failed: boolean; isFavorite: boolean; busy: boolean; toggle: () => Promise<void> };
  className?: string;
  /** "pill" shows the words "Save / Saved" next to the heart. */
  variant?: 'icon' | 'pill';
}

function Heart({ name, state, className, variant = 'icon' }: HeartProps) {
  // Favourites are customer-only; if the list can't load (403, offline) hide the control rather than show a broken one.
  if (state.failed) return null;
  const on = state.isFavorite;
  return (
    <button
      type="button"
      className={clsx('sv-heart', variant === 'pill' && 'pill', on && 'on', className)}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favorites` : `Save ${name} to favorites`}
      disabled={!state.ready || state.busy}
      aria-busy={state.busy || undefined}
      onClick={(e) => {
        // The heart sits next to (or inside) clickable cards; it must never trigger them.
        e.preventDefault();
        e.stopPropagation();
        void state.toggle();
      }}
    >
      <span aria-hidden="true">{on ? '♥' : '♡'}</span>
      {variant === 'pill' && <span>{on ? 'Saved' : 'Save'}</span>}
    </button>
  );
}

export function RestaurantHeart(props: { restaurantId: string; name: string; className?: string; variant?: 'icon' | 'pill' }) {
  const state = useRestaurantFavorite(props.restaurantId, props.name);
  return <Heart name={props.name} state={state} className={props.className} variant={props.variant} />;
}

export function ItemHeart(props: { itemId: string; name: string; className?: string; variant?: 'icon' | 'pill' }) {
  const state = useItemFavorite(props.itemId, props.name);
  return <Heart name={props.name} state={state} className={props.className} variant={props.variant} />;
}
