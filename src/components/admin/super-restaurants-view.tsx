'use client';

import { useMemo, useState } from 'react';
import { ActiveBadge, Chips, LoadError, PageHead, TableSkeleton, dateOnly } from './super-kit';
import { Pager } from './orders-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { usePlatformRestaurants, useToggleRestaurant } from '@/hooks/use-super-admin';
import type { PlatformRestaurant } from '@/lib/api/super-admin';
import { parseError } from '@/lib/errors';
import { ratingOf } from '@/lib/super-admin';

const PAGE = 20;
type Filter = 'all' | 'active' | 'inactive';

export function SuperRestaurantsView() {
  const q = usePlatformRestaurants();
  const toggle = useToggleRestaurant();
  const { push } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<PlatformRestaurant | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const counts = { all: rows.length, active: rows.filter((r) => r.is_active).length, inactive: rows.filter((r) => !r.is_active).length };
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => (filter === 'all' || (filter === 'active') === r.is_active) && (!s || [r.name, r.owner_email, r.city, r.email].some((v) => v?.toLowerCase().includes(s))));
  }, [rows, filter, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const view = shown.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);

  function flip(r: PlatformRestaurant) {
    setBusy(r.id);
    toggle.mutate(r.id, {
      onSuccess: (res) => push(`${r.name} is now ${res.is_active ? 'active' : 'inactive'}`),
      onError: (e) => push(parseError(e).display, 'error'),
      onSettled: () => { setBusy(null); setConfirm(null); },
    });
  }

  return (
    <>
      <PageHead title="Restaurants" description="Every restaurant on the platform. Deactivating one hides it from customers." />
      <div className="ad-stack">
        {q.isError ? <LoadError query={q} what="restaurants" /> : q.isPending ? <TableSkeleton /> : (
          <>
            <div className="su-toolbar">
              <Chips label="Show" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ id: 'all', label: 'All', count: counts.all }, { id: 'active', label: 'Active', count: counts.active }, { id: 'inactive', label: 'Inactive', count: counts.inactive }]} />
              <input className="ad-input su-search" type="search" aria-label="Search restaurants" placeholder="Name, owner or city" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            {shown.length === 0 ? (
              <div className="card ad-empty">
                <div className="ad-empty-icon" aria-hidden="true">🏪</div>
                {rows.length === 0 ? <><strong>No restaurants yet</strong><span>They show up here as soon as an owner creates one.</span></> : <><strong>Nothing matches</strong><Button variant="ghost" onClick={() => { setFilter('all'); setSearch(''); }}>Clear filters</Button></>}
              </div>
            ) : (
              <div className="card">
                <div className="ad-table-wrap">
                  <table className="ad-table su-table">
                    <caption className="sr-only">Restaurants</caption>
                    <thead><tr><th scope="col">Restaurant</th><th scope="col">City</th><th scope="col">Rating</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col" className="su-actions">Action</th></tr></thead>
                    <tbody>
                      {view.map((r) => (
                        <tr key={r.id}>
                          <th scope="row"><div className="su-name">{r.name}</div><div className="su-sub">{r.owner_email ?? r.email ?? ''}</div></th>
                          <td>{r.city || '—'}</td>
                          <td>{ratingOf(r) ? `★ ${ratingOf(r)!.toFixed(1)}` : '—'}</td>
                          <td>{dateOnly(r.created_at)}</td>
                          <td><ActiveBadge active={r.is_active} /></td>
                          <td className="su-actions">
                            <Button variant="ghost" className="ad-btn-sm" loading={busy === r.id} loadingText="…" aria-label={`${r.is_active ? 'Deactivate' : 'Activate'} ${r.name}`} onClick={() => (r.is_active ? setConfirm(r) : flip(r))}>
                              {r.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pager page={Math.min(page, pages)} totalPages={pages} totalItems={shown.length} noun="restaurants" onPage={setPage} />
          </>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Deactivate ${confirm.name}?`}
          message="Customers will no longer see it or be able to order from it. You can turn it back on any time."
          confirmLabel="Deactivate"
          busy={busy === confirm.id}
          onConfirm={() => flip(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
