'use client';

import { useMemo, useState } from 'react';
import { Chips, LoadError, PageHead, TableSkeleton, dateOnly } from './super-kit';
import { Pager } from './orders-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { usePlatformUsers, useToggleUser } from '@/hooks/use-super-admin';
import type { PlatformUser } from '@/lib/api/super-admin';
import { parseError } from '@/lib/errors';
import { ROLE_FILTERS, ROLE_NAME, matchesRole, userName, type RoleFilter } from '@/lib/super-admin';
import { timeAgo } from '@/lib/time-ago';

const PAGE = 25;

export function SuperCustomersView() {
  const q = usePlatformUsers();
  const toggle = useToggleUser();
  const { user: me } = useAuth();
  const { push } = useToast();
  const [role, setRole] = useState<RoleFilter>('CUSTOMER');
  const [search, setSearch] = useState('');
  const [blocked, setBlocked] = useState<'all' | 'blocked'>('all');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<PlatformUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((u) => matchesRole(u, role) && (blocked === 'all' || !u.is_active) && (!s || [u.email, u.first_name, u.last_name, u.phone].some((v) => v?.toLowerCase().includes(s))));
  }, [rows, role, search, blocked]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages);
  const view = shown.slice((at - 1) * PAGE, at * PAGE);
  const blockedCount = rows.filter((u) => matchesRole(u, role) && !u.is_active).length;

  function flip(u: PlatformUser) {
    setBusy(u.id);
    toggle.mutate(u.id, {
      onSuccess: (res) => push(`${userName(u)} is now ${res.is_active ? 'unblocked' : 'blocked'}`),
      onError: (e) => push(parseError(e).display, 'error'),
      onSettled: () => { setBusy(null); setConfirm(null); },
    });
  }

  return (
    <>
      <PageHead title="People" description="Customers, restaurant teams and admins. Blocking someone stops them signing in." />
      <div className="ad-stack">
        {q.isError ? <LoadError query={q} what="people" /> : q.isPending ? <TableSkeleton /> : (
          <>
            <div className="su-toolbar">
              <Chips label="Who" value={role} onChange={(v) => { setRole(v); setPage(1); }} options={ROLE_FILTERS.map((f) => ({ id: f.id, label: f.label, count: rows.filter((u) => matchesRole(u, f.id)).length }))} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Chips label="Status" value={blocked} onChange={(v) => { setBlocked(v); setPage(1); }} options={[{ id: 'all', label: 'Any status' }, { id: 'blocked', label: 'Blocked', count: blockedCount }]} />
                <input className="ad-input su-search" type="search" aria-label="Search people" placeholder="Name, email or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </div>
            {shown.length === 0 ? (
              <div className="card ad-empty">
                <div className="ad-empty-icon" aria-hidden="true">👥</div>
                {rows.length === 0 ? <strong>Nobody has signed up yet</strong> : <><strong>Nothing matches</strong><Button variant="ghost" onClick={() => { setRole('ALL'); setBlocked('all'); setSearch(''); }}>Show everyone</Button></>}
              </div>
            ) : (
              <div className="card">
                <div className="ad-table-wrap">
                  <table className="ad-table su-table">
                    <caption className="sr-only">People</caption>
                    <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Last seen</th><th scope="col">Status</th><th scope="col" className="su-actions">Action</th></tr></thead>
                    <tbody>
                      {view.map((u) => {
                        const self = !!me && (me.id === u.id || me.email === u.email);
                        return (
                          <tr key={u.id}>
                            <th scope="row"><div className="su-name">{userName(u)}</div><div className="su-sub">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></th>
                            <td>{ROLE_NAME[u.role ?? ''] ?? u.role ?? '—'}</td>
                            <td>{dateOnly(u.date_joined)}</td>
                            <td>{u.last_login ? timeAgo(u.last_login) : '—'}</td>
                            <td><span className={`badge ${u.is_active ? 'badge-good' : 'badge-crit'}`}>{u.is_active ? 'Active' : 'Blocked'}</span></td>
                            <td className="su-actions">
                              {self ? <span className="su-you">This is you</span> : (
                                <Button variant="ghost" className="ad-btn-sm" loading={busy === u.id} loadingText="…" aria-label={`${u.is_active ? 'Block' : 'Unblock'} ${userName(u)}`} onClick={() => (u.is_active ? setConfirm(u) : flip(u))}>
                                  {u.is_active ? 'Block' : 'Unblock'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pager page={at} totalPages={pages} totalItems={shown.length} noun="people" onPage={setPage} />
          </>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Block ${userName(confirm)}?`}
          message={`${confirm.email} won't be able to sign in until you unblock them.${confirm.role && confirm.role !== 'CUSTOMER' ? ' They are part of a restaurant team, so that team loses their help too.' : ''}`}
          confirmLabel="Block"
          busy={busy === confirm.id}
          onConfirm={() => flip(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
