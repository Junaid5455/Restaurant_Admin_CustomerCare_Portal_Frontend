'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QueryGate } from './settings-kit';
import { RoleBadge, StaffAvatar, StaffFrame } from './staff-kit';
import { useToast } from '@/components/ui/toast';
import { staffError, useStaff, useStaffCache } from '@/hooks/use-admin-staff';
import { adminStaffApi, type StaffMember, type StaffPermissions } from '@/lib/api/admin-staff';
import { PERMISSIONS, ROLES, displayName, roleDefaults, samePermissions } from '@/lib/staff';

function Matrix({ members }: { members: StaffMember[] }) {
  const { push } = useToast();
  const cache = useStaffCache();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  async function save(m: StaffMember, patch: Partial<StaffPermissions>, done?: string) {
    const key = m.id;
    const undo = cache.patch(m.id, patch);
    setBusy((s) => new Set(s).add(key));
    try {
      const saved = await adminStaffApi.setPermissions(m.id, patch);
      if (saved && typeof saved === 'object' && 'id' in saved) cache.patch(m.id, Object.fromEntries(PERMISSIONS.map((p) => [p.key, !!saved[p.key]])));
      if (done) push(done);
    } catch (e) {
      undo();
      push(staffError(e), 'error');
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }
  }

  return (
    <StaffFrame active="permissions" title="Permissions" description="Decide what each person can do. Changes save as you tick them.">
      <section className="card" aria-labelledby="pm-roles">
        <div className="ad-card-head">
          <h2 id="pm-roles" className="ad-card-title">What each role usually needs</h2>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table st-matrix">
            <caption className="sr-only">Suggested permissions for each role</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                {PERMISSIONS.map((p) => (
                  <th key={p.key} scope="col" className="st-cell">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.id}>
                  <th scope="row"><RoleBadge role={r.id} /></th>
                  {PERMISSIONS.map((p) => (
                    <td key={p.key} className="st-cell">
                      {r.defaults[p.key] ? <span className="st-tick" aria-label="Yes">✓</span> : <span className="st-dash" aria-label="No">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="pm-people">
        <div className="ad-card-head">
          <h2 id="pm-people" className="ad-card-title">Your team</h2>
        </div>
        {members.length === 0 ? (
          <div className="ad-empty">
            <strong>No team members yet</strong>
            <span>Add someone first, then choose what they can do.</span>
            <Link href="/owner/staff/new" className="btn btn-primary">Add staff</Link>
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table st-matrix">
              <caption className="sr-only">Permissions for each team member</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  {PERMISSIONS.map((p) => (
                    <th key={p.key} scope="col" className="st-cell">{p.label}</th>
                  ))}
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const custom = !samePermissions(m, roleDefaults(m.role));
                  return (
                    <tr key={m.id} className={m.is_active ? '' : 'is-off'}>
                      <th scope="row">
                        <div className="st-who">
                          <StaffAvatar member={m} size={36} />
                          <div>
                            <Link href={`/owner/staff/${m.id}`} className="ad-rowlink">{displayName(m)}</Link>
                            <div><RoleBadge role={m.role} /> {!m.is_active && <span className="badge badge-neutral">Inactive</span>}</div>
                          </div>
                        </div>
                      </th>
                      {PERMISSIONS.map((p) => (
                        <td key={p.key} className="st-cell">
                          <input
                            type="checkbox"
                            checked={!!m[p.key]}
                            disabled={busy.has(m.id)}
                            aria-label={`${p.label} for ${displayName(m)}`}
                            onChange={(e) => save(m, { [p.key]: e.target.checked })}
                          />
                        </td>
                      ))}
                      <td>
                        {custom && (
                          <button type="button" className="ad-link" disabled={busy.has(m.id)} onClick={() => save(m, roleDefaults(m.role), `${displayName(m)} reset to the usual permissions`)}>
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StaffFrame>
  );
}

export function StaffPermissionsView() {
  const query = useStaff();
  return <QueryGate query={query}>{(data) => <Matrix members={data} />}</QueryGate>;
}
