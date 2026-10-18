import Link from 'next/link';
import { SafeImage } from '@/components/ui/safe-image';
import type { RestaurantSummary } from '@/lib/api/restaurants';
import { formatMoney, initials, isOpenNow, toNumber } from '@/lib/format';

export function RestaurantRating({ rating, reviews }: { rating: string; reviews: number }) {
  if (reviews <= 0 || toNumber(rating) <= 0) return <span className="badge badge-violet">New</span>;
  return (
    <span className="rating" aria-label={`Rated ${toNumber(rating).toFixed(1)} from ${reviews} reviews`}>
      ★ {toNumber(rating).toFixed(1)} <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>({reviews})</span>
    </span>
  );
}

export function RestaurantCard({ restaurant: r }: { restaurant: RestaurantSummary }) {
  const open = isOpenNow(r);
  const fee = r.delivery_fee !== undefined ? toNumber(r.delivery_fee) : null;

  return (
    <Link href={`/customer/restaurants/${r.id}`} className="sv-rcard">
      <div className="sv-rcard-media">
        <SafeImage
          src={r.banner ?? r.logo}
          alt=""
          fallback={<span aria-hidden="true">{initials(r.name) || '🍽'}</span>}
        />
        <span className={`badge sv-status-pill sv-rcard-status ${open ? 'badge-good' : 'badge-crit'}`}>
          {open ? '● Open' : '● Closed'}
        </span>
      </div>
      <div className="sv-rcard-body">
        <div className="sv-rcard-name">{r.name}</div>
        <div className="sv-meta">
          <RestaurantRating rating={r.rating} reviews={r.review_count} />
          <span>⏱ {r.delivery_time_minutes} min</span>
          {r.city && <span>📍 {r.city}</span>}
        </div>
        <div className="sv-meta">
          {toNumber(r.min_order_amount) > 0 ? <span>Min {formatMoney(r.min_order_amount)}</span> : <span>No minimum</span>}
          {fee !== null && <span>{fee === 0 ? 'Free delivery' : `Delivery ${formatMoney(fee)}`}</span>}
        </div>
        {(r.allows_delivery || r.allows_pickup || r.allows_dine_in) && (
          <div className="sv-tags">
            {r.allows_delivery && <span className="badge badge-accent">🛵 Delivery</span>}
            {r.allows_pickup && <span className="badge badge-accent">🥡 Pickup</span>}
            {r.allows_dine_in && <span className="badge badge-accent">🍽 Dine-in</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

export function RestaurantCardSkeleton() {
  return (
    <div className="sv-rcard" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <div className="sv-skel" style={{ aspectRatio: '16 / 10', borderRadius: 0 }} />
      <div className="sv-rcard-body">
        <div className="sv-skel" style={{ height: 20, width: '70%' }} />
        <div className="sv-skel" style={{ height: 14, width: '90%' }} />
        <div className="sv-skel" style={{ height: 14, width: '50%' }} />
      </div>
    </div>
  );
}
