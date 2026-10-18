'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ItemModal } from './item-modal';
import { MenuBrowser } from './menu-browser';
import { RestaurantRating } from './restaurant-card';
import { Alert } from '@/components/ui/alert';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/submit-button';
import { restaurantsApi, type MenuItem } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';
import { formatMoney, formatTime, initials, isOpenNow, toNumber } from '@/lib/format';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sv-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function RestaurantDetail({ id }: { id: string }) {
  const restaurantQuery = useQuery({ queryKey: ['restaurant', id], queryFn: () => restaurantsApi.get(id) });
  const menuQuery = useQuery({ queryKey: ['restaurant-menu', id], queryFn: () => restaurantsApi.menu(id) });
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const back = (
    <Link href="/customer/restaurants" className="sv-back">
      ← All restaurants
    </Link>
  );

  if (restaurantQuery.isPending) {
    return (
      <>
        {back}
        <div className="sv-hero" aria-busy="true" aria-label="Loading restaurant">
          <div className="sv-skel" style={{ height: 210, borderRadius: 0 }} />
          <div className="sv-hero-body" style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="sv-skel" style={{ height: 28, width: '40%' }} />
            <div className="sv-skel" style={{ height: 16, width: '70%' }} />
          </div>
        </div>
      </>
    );
  }

  if (restaurantQuery.isError) {
    const err = parseError(restaurantQuery.error);
    const notFound = err.status === 404;
    return (
      <>
        {back}
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">{notFound ? '🔍' : '⚠️'}</div>
          <h2>{notFound ? 'Restaurant not found' : "Couldn't load this restaurant"}</h2>
          <p>{notFound ? 'It may have been removed or is no longer taking orders.' : err.display}</p>
          {notFound ? (
            <Link href="/customer/restaurants" className="btn btn-primary">
              Browse restaurants
            </Link>
          ) : (
            <Button variant="ghost" onClick={() => restaurantQuery.refetch()}>
              Try again
            </Button>
          )}
        </div>
      </>
    );
  }

  const r = restaurantQuery.data;
  const open = isOpenNow(r);
  const address = [r.address, r.city, r.state, r.postal_code].filter(Boolean).join(', ');
  const zones = r.delivery_zones.filter((z) => z.is_active);

  return (
    <>
      {back}

      <section className="sv-hero" aria-labelledby="restaurant-name">
        <div className="sv-hero-banner">
          <SafeImage src={r.banner} alt="" fallback={null} />
        </div>
        <div className="sv-hero-body">
          <div className="sv-hero-top">
            <div className="sv-hero-logo">
              <SafeImage src={r.logo} alt={`${r.name} logo`} fallback={<span aria-hidden="true">{initials(r.name) || '🍽'}</span>} />
            </div>
            <div style={{ flex: 1, minWidth: 220, paddingBottom: 4 }}>
              <h1 id="restaurant-name" className="sv-hero-title">
                {r.name}
              </h1>
              <div className="sv-meta" style={{ marginTop: 6 }}>
                <span className={`badge ${open ? 'badge-good' : 'badge-crit'}`}>{open ? '● Open now' : '● Closed'}</span>
                <RestaurantRating rating={r.rating} reviews={r.review_count} />
                <span>⏱ {r.delivery_time_minutes} min</span>
              </div>
            </div>
          </div>

          {r.description && <p className="sv-hero-desc">{r.description}</p>}

          <div className="sv-tags" style={{ marginTop: 14 }}>
            {r.allows_delivery && <span className="badge badge-accent">🛵 Delivery</span>}
            {r.allows_pickup && <span className="badge badge-accent">🥡 Pickup</span>}
            {r.allows_dine_in && <span className="badge badge-accent">🍽 Dine-in</span>}
          </div>

          <dl className="sv-facts">
            <Fact label="Hours">
              {formatTime(r.opening_time)} – {formatTime(r.closing_time)}
            </Fact>
            <Fact label="Delivery">
              {r.allows_delivery
                ? `${r.delivery_time_minutes} min · ${toNumber(r.delivery_fee) === 0 ? 'Free' : formatMoney(r.delivery_fee)}`
                : 'Not available'}
            </Fact>
            <Fact label="Minimum order">{toNumber(r.min_order_amount) > 0 ? formatMoney(r.min_order_amount) : 'None'}</Fact>
            {address && <Fact label="Address">{address}</Fact>}
            {r.phone && (
              <Fact label="Phone">
                <a href={`tel:${r.phone}`}>{r.phone}</a>
              </Fact>
            )}
            {r.email && (
              <Fact label="Email">
                <a href={`mailto:${r.email}`}>{r.email}</a>
              </Fact>
            )}
          </dl>

          {zones.length > 0 && (
            <details className="sv-zones">
              <summary>Delivery areas ({zones.length})</summary>
              <ul>
                {zones.map((z) => (
                  <li key={z.id}>
                    <strong>{z.zone_name}</strong>
                    <small>
                      {toNumber(z.delivery_fee) === 0 ? 'Free delivery' : formatMoney(z.delivery_fee)} · {z.delivery_time_minutes} min
                    </small>
                    {z.postal_codes && <small>Postal codes: {z.postal_codes}</small>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      {!open && (
        <div className="sv-banner-note" role="status">
          <span aria-hidden="true">🕒</span>
          <span>
            This restaurant is closed right now (open {formatTime(r.opening_time)} – {formatTime(r.closing_time)}). You can browse
            the menu, but your order may not be accepted until it opens.
          </span>
        </div>
      )}

      <section aria-labelledby="menu-heading" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="menu-heading" style={{ fontSize: 22, fontWeight: 800 }}>
          Menu
        </h2>
        {menuQuery.isPending ? (
          <div className="sv-items" aria-busy="true" aria-label="Loading menu">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sv-skel" style={{ height: 124, borderRadius: 14 }} />
            ))}
          </div>
        ) : menuQuery.isError ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <Alert>{parseError(menuQuery.error).display}</Alert>
            <Button variant="ghost" onClick={() => menuQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <MenuBrowser restaurantId={r.id} categories={menuQuery.data} onSelect={setSelected} />
        )}
      </section>

      {selected && (
        <ItemModal key={selected.id} item={selected} restaurant={{ id: r.id, name: r.name }} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
