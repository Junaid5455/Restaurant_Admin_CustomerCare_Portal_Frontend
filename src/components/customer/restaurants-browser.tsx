'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RestaurantCard, RestaurantCardSkeleton } from './restaurant-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { restaurantsApi } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';

const SORTS = [
  { value: '-rating', label: 'Top rated' },
  { value: '-created_at', label: 'Newest' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'delivery_fee', label: 'Lowest delivery fee' },
] as const;
const DEFAULT_SORT = '-rating';
/** Matches REST_FRAMEWORK["PAGE_SIZE"] on the backend (the restaurants list doesn't accept ?page_size). */
const PAGE_SIZE = 20;

export function RestaurantsBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get('q') ?? '';
  const delivery = params.get('delivery') === '1';
  const pickup = params.get('pickup') === '1';
  const sortParam = params.get('sort');
  const sort = SORTS.some((s) => s.value === sortParam) ? (sortParam as string) : DEFAULT_SORT;
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  function update(changes: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!keepPage) next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const query = useQuery({
    queryKey: ['restaurants', { q, delivery, pickup, sort, page }],
    queryFn: () =>
      restaurantsApi.list({
        search: q || undefined,
        allows_delivery: delivery || undefined,
        allows_pickup: pickup || undefined,
        ordering: sort,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const error = query.error ? parseError(query.error) : null;
  const filtersActive = delivery || pickup || sort !== DEFAULT_SORT || !!q;
  const pageSize = data?.next ? data.results.length || PAGE_SIZE : PAGE_SIZE;
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;

  // A stale ?page= beyond the last page is a 404 from DRF: fall back to page 1.
  useEffect(() => {
    if (error?.status === 404 && page > 1) update({ page: null }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.status, page]);

  function goToPage(next: number) {
    update({ page: next <= 1 ? null : String(next) }, true);
    document.querySelector('.sv-content')?.scrollTo({ top: 0 });
  }

  return (
    <>
      <div className="sv-page-head">
        <h1>Find your next meal</h1>
        <p>Browse restaurants near you, then pick a dish to order.</p>
      </div>

      <div className="sv-filterbar" role="group" aria-label="Filters">
        <button
          type="button"
          className="sv-chip"
          aria-pressed={delivery}
          onClick={() => update({ delivery: delivery ? null : '1' })}
        >
          🛵 Delivery
        </button>
        <button
          type="button"
          className="sv-chip"
          aria-pressed={pickup}
          onClick={() => update({ pickup: pickup ? null : '1' })}
        >
          🥡 Pickup
        </button>
        <span className="spacer" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-2)', fontSize: 13 }}>
          Sort by
          <select
            className="sv-select"
            value={sort}
            onChange={(e) => update({ sort: e.target.value === DEFAULT_SORT ? null : e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="sv-results-line" aria-live="polite">
        {data && !error && (
          <span>
            {data.count} {data.count === 1 ? 'restaurant' : 'restaurants'}
          </span>
        )}
        {q && (
          <button type="button" className="sv-chip active" onClick={() => update({ q: null })} aria-label={`Clear search for ${q}`}>
            “{q}” ✕
          </button>
        )}
        {filtersActive && (
          <button
            type="button"
            className="link"
            onClick={() => router.replace(pathname, { scroll: false })}
          >
            Clear all filters
          </button>
        )}
      </div>

      {error && !(error.status === 404 && page > 1) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <Alert>{error.display}</Alert>
          <Button variant="ghost" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <div className="sv-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.results.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">🍽</div>
          <h2>{filtersActive ? 'No restaurants match your filters' : 'No restaurants yet'}</h2>
          <p>
            {filtersActive
              ? 'Try a different search, or remove a filter to see more places.'
              : 'Restaurants will show up here once they are added to the platform.'}
          </p>
          {filtersActive && (
            <Button variant="ghost" onClick={() => router.replace(pathname, { scroll: false })}>
              Clear filters
            </Button>
          )}
        </div>
      ) : data ? (
        <>
          <div className={`sv-grid ${query.isPlaceholderData ? 'dim' : ''}`}>
            {data.results.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="sv-pager" aria-label="Pagination">
              <Button variant="ghost" disabled={!data.previous || page <= 1} onClick={() => goToPage(page - 1)}>
                ← Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button variant="ghost" disabled={!data.next} onClick={() => goToPage(page + 1)}>
                Next →
              </Button>
            </nav>
          )}
        </>
      ) : null}
    </>
  );
}
