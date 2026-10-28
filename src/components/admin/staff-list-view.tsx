'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { MiniSwitch } from './menu-kit';
import { QueryGate } from './settings-kit';
import { PermissionChips, RoleBadge, StaffAvatar, StaffFrame } from './staff-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { useToast } from '@/components/ui/toast';
import { staffError, useStaff, useStaffCache } from '@/hooks/use-admin-staff';
import { adminStaffApi, type StaffMember } from '@/lib/api/admin-staff';
import { displayName, ROLES } from '@/lib/staff';
import { timeAgo } from '@/lib/time-ago';

function Team({ members }: { members: StaffMember[] }) {
  const { push } = useToast();
  const cache = useStaffCache();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('');
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        (!q || m.user_email.toLowerCase().includes(q) || displayName(m).toLowerCase().includes(q)) &&
        (!role || m.role === role) &&
        (!status || (status === 'active') === m.is_active),
    );
  }, [members, search, role, status]);
  const filtersActive = !!(search || role || status);
  const activeCount = members.filter((m) => m.is_active).length;

  async function setActive(m: StaffMember, next: boolean) {
    if (m.is_active === next) return;
    const undo = cache.patch(m.id, { is_active: next });
    setBusy((s) => new Set(s).add(m.id));
    try {
      // The server only offers a toggle, so ask for it once and trust the answer.
      const res = await adminStaffApi.toggleActive(m.id);
      cache.patch(m.id, { is_active: res.is_active });
      push(`${displayName(m)} is now ${res.is_active ? 'active' : 'inactive'}`);
      void cache.refresh();
    } catch (e) {
      undo();
      push(staffError(e), 'error');
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(m.id);
        return n;
      });
    }
  }

  async function remove(m: StaffMember) {
    setRemoveBusy(true);
    try {
      await adminStaffApi.remove(m.id);
      await cache.refresh();
      push(`${displayName(m)} removed from your team`);
      setRemoving(null);
    } catch (e) {
      push(staffError(e), 'error');
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <StaffFrame
      active="team"
      title="Team"
      description={members.length ? `${members.length} ${members.length === 1 ? 'person' : 'people'}, ${activeCount} active.` : 'The people who work at your restaurant.'}
      actions={<Link href="/owner/staff/new" className="btn btn-primary">+ Add staff</Link>}
    >
      {members.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">👥</div>
          <strong>No team members yet</strong>
          <span>Add the people who work in your kitchen, front of house and deliveries, and choose what each can do.</span>
          <Link href="/owner/staff/new" className="btn btn-primary">Add your first team member</Link>
        </div>
      ) : (
        <>
          <div className="ad-filterbar" role="group" aria-label="Filter team">
            <label className="ad-filter ad-grow">
              Search
              <input className="ad-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
            </label>
            <label className="ad-filter">
              Role
              <select className="ad-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">All roles</option>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="ad-filter">
              Status
              <select className="ad-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            {filtersActive && (
              <button type="button" className="ad-link" onClick={() => { setSearch(''); setRole(''); setStatus(''); }}>Clear filters</button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="card ad-empty">
              <div className="ad-empty-icon" aria-hidden="true">🔍</div>
              <strong>No one matches these filters</strong>
              <span>Try a different search or clear the filters.</span>
            </div>
          ) : (
            <div className="card">
              <ul className="st-list" aria-label="Team members">
                {filtered.map((m) => (
                  <li key={m.id} className={m.is_active ? '' : 'is-off'}>
                    <StaffAvatar member={m} />
                    <div className="st-main">
                      <div className="st-name">
                        <Link href={`/owner/staff/${m.id}`} className="ad-rowlink">{displayName(m)}</Link>
                        <RoleBadge role={m.role} />
                        {!m.is_active && <span className="badge badge-neutral">Inactive</span>}
                      </div>
                      <div className="st-email">
                        {m.user_email}
                        {m.last_login ? ` · last seen ${timeAgo(m.last_login)}` : ''}
                      </div>
                      <PermissionChips perms={m} />
                    </div>
                    <div className="st-tools">
                      <MiniSwitch checked={m.is_active} label={`${displayName(m)} is active`} disabled={busy.has(m.id)} onChange={(v) => setActive(m, v)} />
                      <Link href={`/owner/staff/${m.id}`} className="ad-link" aria-label={`Edit ${displayName(m)}`}>Edit</Link>
                      <button type="button" className="ad-link danger" aria-label={`Remove ${displayName(m)}`} onClick={() => setRemoving(m)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${displayName(removing)}?`}
          message="They're taken off your team and lose their role here. Their sign-in account isn't deleted. If you only want to pause their access for a while, turn them inactive instead."
          confirmLabel="Remove from team"
          busy={removeBusy}
          onConfirm={() => remove(removing)}
          onClose={() => !removeBusy && setRemoving(null)}
        />
      )}
    </StaffFrame>
  );
}

export function StaffListView() {
  const query = useStaff();
  return <QueryGate query={query}>{(data) => <Team members={data} />}</QueryGate>;
}
