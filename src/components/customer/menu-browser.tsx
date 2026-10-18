'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { MenuItemCard } from './menu-item-card';
import { restaurantsApi, type DietFlag, type MenuCategory, type MenuItem } from '@/lib/api/restaurants';

const DIETS: { key: DietFlag; label: string }[] = [
  { key: 'is_vegetarian', label: '🥬 Vegetarian' },
  { key: 'is_vegan', label: '🌱 Vegan' },
  { key: 'is_spicy', label: '🌶 Spicy' },
];

interface Section {
  id: string;
  name: string;
  description: string | null;
  items: MenuItem[];
}

export function MenuBrowser({
  restaurantId,
  categories,
  onSelect,
}: {
  restaurantId: string;
  categories: MenuCategory[];
  onSelect: (item: MenuItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [diets, setDiets] = useState<DietFlag[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Dietary flags aren't in the menu payload; fetch matching item ids lazily when a chip is switched on.
  const dietQueries = useQueries({
    queries: DIETS.map((d) => ({
      queryKey: ['diet-ids', restaurantId, d.key],
      queryFn: () => restaurantsApi.dietItemIds(restaurantId, d.key),
      enabled: diets.includes(d.key),
      staleTime: 5 * 60_000,
    })),
  });
  const dietSignature = dietQueries.map((q) => `${q.status}:${q.dataUpdatedAt}`).join('|');
  const activeDietQueries = DIETS.map((d, i) => ({ d, q: dietQueries[i] })).filter(({ d }) => diets.includes(d.key));
  const dietLoading = activeDietQueries.some(({ q }) => q.isPending);
  const dietFailed = activeDietQueries.some(({ q }) => q.isError);

  const sections: Section[] = useMemo(() => {
    const needle = search.trim().toLowerCase();

    // Intersect the id sets of every active diet chip (vegetarian AND spicy, etc.).
    // Chips that are still loading or failed are skipped so they never hide everything.
    const idSets = activeDietQueries.flatMap(({ q }) => (q.data ? [new Set(q.data)] : []));
    const allowed: Set<string> | null = idSets.length
      ? idSets.reduce((acc, set) => new Set([...acc].filter((id) => set.has(id))))
      : null;

    const matches = (item: MenuItem) =>
      (!allowed || allowed.has(item.id)) &&
      (!needle || item.name.toLowerCase().includes(needle) || item.description?.toLowerCase().includes(needle));

    const filtered = categories
      .map((c) => ({ id: c.id, name: c.name, description: c.description, items: c.items.filter(matches) }))
      .filter((c) => c.items.length > 0);

    const filtering = needle !== '' || diets.length > 0;
    const featured = filtering ? [] : categories.flatMap((c) => c.items).filter((i) => i.is_featured);
    return featured.length
      ? [{ id: 'featured', name: '⭐ Featured', description: 'Chef’s picks and customer favourites.', items: featured }, ...filtered]
      : filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, search, diets, dietSignature]);

  // Highlight the category currently under the sticky nav.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`sec-${s.id}`)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id.replace('sec-', ''));
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  function jumpTo(id: string) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveId(id);
  }

  function toggleDiet(key: DietFlag) {
    setDiets((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  if (categories.length === 0) {
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">📋</div>
        <h2>No menu yet</h2>
        <p>This restaurant hasn't published its menu. Check back soon.</p>
      </div>
    );
  }

  const filtering = search.trim() !== '' || diets.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="sv-menu-tools">
        <div className="sv-menu-search">
          <span className="sv-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            aria-label="Search this menu"
            placeholder="Search this menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {DIETS.map((d) => (
          <button key={d.key} type="button" className="sv-chip" aria-pressed={diets.includes(d.key)} onClick={() => toggleDiet(d.key)}>
            {d.label}
          </button>
        ))}
      </div>

      {dietLoading && <p className="field-hint" role="status">Applying dietary filter…</p>}
      {dietFailed && <p className="field-error" role="alert">Couldn't load the dietary filter. Showing everything instead.</p>}

      {sections.length > 0 && (
        <nav className="sv-menu-nav" aria-label="Menu categories">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sv-chip ${activeId === s.id || (!activeId && s === sections[0]) ? 'active' : ''}`}
              onClick={() => jumpTo(s.id)}
            >
              {s.name}
            </button>
          ))}
        </nav>
      )}

      {sections.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">🔎</div>
          <h2>Nothing matches</h2>
          <p>{filtering ? 'No dishes match your search or filters.' : 'There are no available dishes right now.'}</p>
          {filtering && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setSearch('');
                setDiets([]);
              }}
            >
              Clear search and filters
            </button>
          )}
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="sv-section" aria-labelledby={`sec-h-${s.id}`}>
            <h2 id={`sec-h-${s.id}`}>{s.name}</h2>
            {s.description && <p>{s.description}</p>}
            <div className="sv-items">
              {s.items.map((item) => (
                <MenuItemCard key={`${s.id}-${item.id}`} item={item} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
