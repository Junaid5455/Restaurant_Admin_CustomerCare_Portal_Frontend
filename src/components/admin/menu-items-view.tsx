'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MenuFrame, MiniSwitch, Thumb } from './menu-kit';
import { QueryGate } from './settings-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { useToast } from '@/components/ui/toast';
import { menuError, useMenu, useMenuCache } from '@/hooks/use-admin-menu';
import { adminMenuApi, type MenuCategory, type MenuItem } from '@/lib/api/admin-menu';
import { formatMoney } from '@/lib/format';

type Availability = '' | 'yes' | 'no';

function Items({ categories, items }: { categories: MenuCategory[]; items: MenuItem[] }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState<Availability>('');
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)) &&
        (!category || (category === 'none' ? i.category_id === null : i.category_id === category)) &&
        (!availability || (availability === 'yes') === i.is_available),
    );
  }, [items, search, category, availability]);

  const groups = useMemo(() => {
    const out: { id: string; name: string; rows: MenuItem[] }[] = [];
    for (const c of categories) {
      const rows = filtered.filter((i) => i.category_id === c.id).sort((a, b) => a.name.localeCompare(b.name));
      if (rows.length) out.push({ id: c.id, name: c.name, rows });
    }
    const loose = filtered.filter((i) => i.category_id === null).sort((a, b) => a.name.localeCompare(b.name));
    if (loose.length) out.push({ id: 'none', name: 'No category', rows: loose });
    return out;
  }, [categories, filtered]);

  const unavailable = items.filter((i) => !i.is_available).length;
  const filtersActive = !!search.trim() || !!category || !!availability;

  async function setFlag(item: MenuItem, key: 'is_available' | 'is_featured', next: boolean, label: string) {
    const undo = cache.patchItem(item.id, { [key]: next });
    setBusy((b) => new Set(b).add(item.id + key));
    try {
      await adminMenuApi.updateItem(item.id, { [key]: next });
      push(`${item.name}: ${label}`);
    } catch (e) {
      undo();
      push(menuError(e), 'error');
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(item.id + key);
        return n;
      });
    }
  }

  async function remove(item: MenuItem) {
    setDeleteBusy(true);
    try {
      await adminMenuApi.deleteItem(item.id);
      await cache.refresh();
      push(`${item.name} deleted`);
      setDeleting(null);
    } catch (e) {
      push(menuError(e), 'error');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <MenuFrame
      active="items"
      title="Menu items"
      description={items.length ? `${items.length} ${items.length === 1 ? 'dish' : 'dishes'}${unavailable ? `, ${unavailable} unavailable` : ''}. Turn a dish off when you run out.` : 'The dishes guests can order.'}
      actions={<Link href="/owner/menu/items/new" className="btn btn-primary">+ Add item</Link>}
    >
      {categories.length === 0 && items.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">🍽</div>
          <strong>Your menu is empty</strong>
          <span>Start with a category, then add dishes. Or import a spreadsheet.</span>
          <div className="ad-actions" style={{ justifyContent: 'center' }}>
            <Link href="/owner/menu/categories" className="btn btn-primary">Add a category</Link>
            <Link href="/owner/menu/import" className="btn btn-ghost">Import from CSV</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="ad-filterbar" role="group" aria-label="Filter items">
            <label className="ad-filter ad-grow">
              Search
              <input className="ad-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Dish name or description" />
            </label>
            <label className="ad-filter">
              Category
              <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {items.some((i) => i.category_id === null) && <option value="none">No category</option>}
              </select>
            </label>
            <label className="ad-filter">
              Availability
              <select className="ad-select" value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
                <option value="">All</option>
                <option value="yes">Available</option>
                <option value="no">Unavailable</option>
              </select>
            </label>
            {filtersActive && (
              <button type="button" className="ad-link" onClick={() => { setSearch(''); setCategory(''); setAvailability(''); }}>
                Clear filters
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card ad-empty">
              <div className="ad-empty-icon" aria-hidden="true">🔍</div>
              <strong>{filtersActive ? 'No dishes match these filters' : 'No dishes yet'}</strong>
              <span>{filtersActive ? 'Try a different search or clear the filters.' : 'Add your first dish to get started.'}</span>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.id} aria-labelledby={`grp-${g.id}`}>
                <h2 id={`grp-${g.id}`} className="ad-section-title" style={{ marginBottom: 10 }}>
                  {g.name} <span className="ad-muted">{g.rows.length}</span>
                </h2>
                <div className="card">
                  <ul className="ad-menu-items">
                    {g.rows.map((i) => (
                      <li key={i.id} className={i.is_available ? '' : 'is-off'}>
                        <Thumb src={i.image} name={i.name} size={52} />
                        <div className="ad-list-main">
                          <div className="ad-list-title">
                            <Link href={`/owner/menu/items/${i.id}`} className="ad-rowlink">{i.name}</Link>{' '}
                            {i.is_new && <span className="badge badge-accent">New</span>}{' '}
                            {i.is_featured && <span className="badge badge-warn">Featured</span>}{' '}
                            {!i.is_available && <span className="badge badge-neutral">Unavailable</span>}
                          </div>
                          <div className="ad-list-sub">{formatMoney(i.price)} · {i.prep_time} min{i.description ? ` · ${i.description}` : ''}</div>
                        </div>
                        <div className="ad-row-tools">
                          <button
                            type="button"
                            className={`ad-icon-btn star ${i.is_featured ? 'on' : ''}`}
                            aria-pressed={i.is_featured}
                            aria-label={`${i.is_featured ? 'Unfeature' : 'Feature'} ${i.name}`}
                            disabled={busy.has(i.id + 'is_featured')}
                            onClick={() => setFlag(i, 'is_featured', !i.is_featured, i.is_featured ? 'no longer featured' : 'featured')}
                          >
                            ★
                          </button>
                          <MiniSwitch checked={i.is_available} label={`${i.name} is available`} disabled={busy.has(i.id + 'is_available')} onChange={(v) => setFlag(i, 'is_available', v, v ? 'available' : 'unavailable')} />
                          <Link href={`/owner/menu/items/${i.id}`} className="ad-link" aria-label={`Edit ${i.name}`}>Edit</Link>
                          <button type="button" className="ad-link danger" aria-label={`Delete ${i.name}`} onClick={() => setDeleting(i)}>Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))
          )}
        </>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message="It disappears from your menu. Past orders keep the name and price. This can't be undone."
          confirmLabel="Delete dish"
          busy={deleteBusy}
          onConfirm={() => remove(deleting)}
          onClose={() => !deleteBusy && setDeleting(null)}
        />
      )}
    </MenuFrame>
  );
}

export function MenuItemsView() {
  const query = useMenu();
  return <QueryGate query={query}>{(data) => <Items categories={data.categories} items={data.items} />}</QueryGate>;
}
