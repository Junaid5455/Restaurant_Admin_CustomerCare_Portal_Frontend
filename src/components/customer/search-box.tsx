'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SafeImage } from '@/components/ui/safe-image';
import { useDebounce } from '@/hooks/use-debounce';
import { restaurantsApi } from '@/lib/api/restaurants';
import { initials } from '@/lib/format';

export const RESTAURANTS_PATH = '/customer/restaurants';

/**
 * Topbar search. Typing shows live suggestions (GET /restaurants/search/?q=, 2+ chars);
 * Enter applies the text to the restaurant list's ?q= filter.
 */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const urlQuery = pathname === RESTAURANTS_PATH ? (params.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Keep the box in sync when the URL changes (clear chip, navigating away).
  useEffect(() => setValue(urlQuery), [urlQuery]);

  const trimmed = value.trim();
  const debounced = useDebounce(trimmed, 300);
  const ready = debounced.length >= 2 && debounced === trimmed;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['restaurant-search', debounced],
    queryFn: () => restaurantsApi.search(debounced),
    enabled: open && ready,
    staleTime: 60_000,
  });

  const results = ready ? (data?.restaurants ?? []).slice(0, 6) : [];
  const rows = results.length + 1; // + "see all" row

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function applyToList() {
    setOpen(false);
    const target = trimmed ? `${RESTAURANTS_PATH}?q=${encodeURIComponent(trimmed)}` : RESTAURANTS_PATH;
    if (pathname === RESTAURANTS_PATH) router.replace(target);
    else router.push(target);
  }

  function openRestaurant(id: string) {
    setOpen(false);
    router.push(`${RESTAURANTS_PATH}/${id}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && trimmed.length >= 2) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % rows);
    } else if (e.key === 'ArrowUp' && trimmed.length >= 2) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rows - 1 : a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && active < results.length) openRestaurant(results[active].id);
      else applyToList();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const showPanel = open && trimmed.length >= 2;

  return (
    <div className="sv-search" ref={wrapRef}>
      <span className="sv-search-icon" aria-hidden="true">🔍</span>
      <input
        type="search"
        role="combobox"
        aria-label="Search restaurants"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Search restaurants, cuisines, cities…"
        value={value}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showPanel && (
        <div className="sv-suggest" id={listId} role="listbox" aria-label="Restaurant suggestions">
          {!ready || (isFetching && !data) ? (
            <div className="sv-suggest-note">Searching…</div>
          ) : isError ? (
            <div className="sv-suggest-note">Couldn't search right now.</div>
          ) : results.length === 0 ? (
            <div className="sv-suggest-note">No restaurants match “{debounced}”.</div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active === i}
                className="sv-suggest-row"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openRestaurant(r.id)}
              >
                <span className="sv-suggest-logo">
                  <SafeImage src={r.logo} alt="" fallback={<span>{initials(r.name) || '🍽'}</span>} />
                </span>
                <span className="sv-suggest-name">{r.name}</span>
                <span className="sv-suggest-meta">{Number(r.rating) > 0 ? `★ ${Number(r.rating).toFixed(1)}` : 'New'}</span>
              </div>
            ))
          )}
          {ready && (
            <div
              id={`${listId}-${results.length}`}
              role="option"
              aria-selected={active === results.length}
              className="sv-suggest-row all"
              onMouseEnter={() => setActive(results.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyToList}
            >
              See all results for “{debounced}” →
            </div>
          )}
        </div>
      )}
    </div>
  );
}
