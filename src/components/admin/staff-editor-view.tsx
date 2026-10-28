'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { QueryGate, SaveBar, mapSaveError } from './settings-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { staffError, useStaff, useStaffCache } from '@/hooks/use-admin-staff';
import { useUnsavedWarning } from '@/hooks/use-restaurant-settings';
import { adminStaffApi, type StaffMember, type StaffPatch, type StaffPermissions, type StaffRole } from '@/lib/api/admin-staff';
import { PERMISSIONS, ROLES, displayName, pickPermissions, roleDefaults, roleLabel, samePermissions } from '@/lib/staff';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Editor({ member, members }: { member: StaffMember | null; members: StaffMember[] }) {
  const router = useRouter();
  const { user } = useAuth();
  const { push } = useToast();
  const cache = useStaffCache();

  const [baseline, setBaseline] = useState(() => ({ role: (member?.role ?? 'KITCHEN_STAFF') as StaffRole, perms: member ? pickPermissions(member) : roleDefaults('KITCHEN_STAFF') }));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>(baseline.role);
  const [perms, setPerms] = useState<StaffPermissions>(baseline.perms);
  const [errors, setErrors] = useState<{ staff_email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<StaffMember | null>(null);
  const [active, setActive] = useState(member?.is_active ?? true);
  const [activeBusy, setActiveBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  const dirty = member ? role !== baseline.role || !samePermissions(perms, baseline.perms) : email.trim() !== '' || role !== 'KITCHEN_STAFF' || !samePermissions(perms, roleDefaults('KITCHEN_STAFF'));
  useUnsavedWarning(dirty && !created);

  function chooseRole(next: StaffRole) {
    // Follow the new role's suggested permissions, unless the owner has already customised them.
    if (samePermissions(perms, roleDefaults(role))) setPerms(roleDefaults(next));
    setRole(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    const addr = email.trim().toLowerCase();
    if (!member) {
      if (!addr) found.staff_email = "Enter this person's email address";
      else if (!EMAIL.test(addr)) found.staff_email = 'That email address looks incomplete';
      else if (user?.email && addr === user.email.toLowerCase()) found.staff_email = "That's your own account. You don't need to add yourself";
      else if (members.some((m) => m.user_email.toLowerCase() === addr)) found.staff_email = 'This person is already on your team';
    }
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => (e.target as HTMLElement).querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      if (member) {
        const patch: StaffPatch = {};
        if (role !== baseline.role) patch.role = role;
        PERMISSIONS.forEach((p) => { if (perms[p.key] !== baseline.perms[p.key]) patch[p.key] = perms[p.key]; });
        const saved = await adminStaffApi.update(member.id, patch);
        setBaseline({ role: saved.role ?? role, perms: pickPermissions(saved) });
        await cache.refresh();
        push('Changes saved');
      } else {
        const saved = await adminStaffApi.create({ staff_email: addr, role, ...perms });
        await cache.refresh();
        setCreated({ ...saved, user_email: saved.user_email ?? addr });
      }
    } catch (err) {
      const m = mapSaveError(err, ['staff_email', 'role']);
      setErrors({ staff_email: m.fields.staff_email });
      setFormError(m.form ? staffError(err) : null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(next: boolean) {
    if (!member) return;
    setActiveBusy(true);
    const undo = cache.patch(member.id, { is_active: next });
    setActive(next);
    try {
      const res = await adminStaffApi.toggleActive(member.id);
      setActive(res.is_active);
      cache.patch(member.id, { is_active: res.is_active });
      push(`${displayName(member)} is now ${res.is_active ? 'active' : 'inactive'}`);
      void cache.refresh();
    } catch (err) {
      undo();
      setActive(!next);
      push(staffError(err), 'error');
    } finally {
      setActiveBusy(false);
    }
  }

  async function remove() {
    if (!member) return;
    setRemoveBusy(true);
    try {
      await adminStaffApi.remove(member.id);
      await cache.refresh();
      push(`${displayName(member)} removed from your team`);
      router.push('/owner/staff');
    } catch (err) {
      push(staffError(err), 'error');
      setRemoveBusy(false);
    }
  }

  if (created) {
    return (
      <>
        <div className="ad-head"><div><h1>Added to your team</h1><p>{created.user_email} is now {roleLabel(created.role).toLowerCase()}.</p></div></div>
        <div className="ad-stack">
          <section className="card ad-card-pad st-success" aria-labelledby="st-done">
            <h2 id="st-done" className="ad-rowhead-title">What happens next</h2>
            <ol className="st-steps">
              <li>We don&apos;t send an invitation yet, so let {created.user_email} know they&apos;ve been added.</li>
              <li>A new account has no password. They open the team sign-in, choose <strong>Forgot password</strong>, and use this email address to set one.</li>
              <li>Once signed in, they land on their own screen.</li>
            </ol>
            <div className="ad-actions">
              <Link href="/owner/staff" className="btn btn-primary">Back to the team</Link>
              <Link href={`/owner/staff/${created.id}`} className="btn btn-ghost">Review their access</Link>
              <Button variant="ghost" onClick={() => { setCreated(null); setEmail(''); setRole('KITCHEN_STAFF'); setPerms(roleDefaults('KITCHEN_STAFF')); setErrors({}); }}>Add another person</Button>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/owner/staff" className="ad-back">← Team</Link>
      <div className="ad-head">
        <div>
          <h1>{member ? displayName(member) : 'Add a team member'}</h1>
          <p>{member ? member.user_email : 'Enter their email, pick a role, and choose what they can do.'}</p>
        </div>
        {member && (
          <div className="ad-head-actions">
            <button type="button" className="ad-link danger" onClick={() => setRemoving(true)}>Remove from team</button>
          </div>
        )}
      </div>

      <div className="ad-stack">
        <form onSubmit={submit} noValidate className="ad-stack">
          {!member && (
            <section className="card ad-card-pad" aria-labelledby="st-who">
              <h2 id="st-who" className="ad-rowhead-title">Who is joining?</h2>
              <TextField
                label="Email address"
                type="email"
                autoComplete="off"
                value={email}
                maxLength={254}
                placeholder="name@example.com"
                onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                error={errors.staff_email}
                hint="If this email already has a guest account, it becomes a team account."
              />
            </section>
          )}

          <section className="card ad-card-pad" aria-labelledby="st-role">
            <h2 id="st-role" className="ad-rowhead-title">Role</h2>
            <div className="st-roles" role="radiogroup" aria-labelledby="st-role">
              {ROLES.map((r) => (
                <label key={r.id} className={`st-role-opt ${role === r.id ? 'is-on' : ''}`}>
                  <input type="radio" name="staff-role" value={r.id} checked={role === r.id} onChange={() => chooseRole(r.id)} />
                  <strong>{r.label}</strong>
                  <span>{r.blurb}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="card ad-card-pad" aria-labelledby="st-perms">
            <h2 id="st-perms" className="ad-rowhead-title">Permissions</h2>
            <fieldset className="st-perms">
              <legend className="sr-only">What {member ? displayName(member) : 'this person'} can do</legend>
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="st-perm">
                  <input type="checkbox" checked={perms[p.key]} onChange={(e) => setPerms((x) => ({ ...x, [p.key]: e.target.checked }))} />
                  <span>
                    <strong>{p.label}</strong>
                    <small>{p.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {!samePermissions(perms, roleDefaults(role)) && (
              <button type="button" className="ad-link st-reset" onClick={() => setPerms(roleDefaults(role))}>
                Use the usual {roleLabel(role).toLowerCase()} permissions
              </button>
            )}
          </section>

          <SaveBar
            dirty={dirty}
            busy={busy}
            error={formError}
            saveLabel={member ? 'Save changes' : 'Add to team'}
            onDiscard={() => { setRole(baseline.role); setPerms(baseline.perms); setEmail(''); setErrors({}); setFormError(null); }}
          />
        </form>

        {member && (
          <section className="card ad-card-pad" aria-labelledby="st-access">
            <h2 id="st-access" className="ad-rowhead-title">Access</h2>
            <Switch
              label="Active"
              description="Turn off to pause this person without removing them. You can turn them back on any time."
              checked={active}
              disabled={activeBusy}
              onChange={toggleActive}
            />
            <div className="ad-muted">
              Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {member.last_login ? ` · last seen ${new Date(member.last_login).toLocaleString()}` : ''}
            </div>
          </section>
        )}
      </div>

      {removing && member && (
        <ConfirmDialog
          title={`Remove ${displayName(member)}?`}
          message="They're taken off your team and lose their role here. Their sign-in account isn't deleted. If you only want to pause their access for a while, turn them inactive instead."
          confirmLabel="Remove from team"
          busy={removeBusy}
          onConfirm={remove}
          onClose={() => !removeBusy && setRemoving(false)}
        />
      )}
    </>
  );
}

export function StaffEditorView({ id }: { id: string | null }) {
  const query = useStaff();
  if (id === null) return <QueryGate query={query}>{(data) => <Editor key="new" member={null} members={data} />}</QueryGate>;
  return (
    <QueryGate query={query}>
      {(data) => {
        const m = data.find((x) => x.id === id);
        if (!m) {
          return (
            <div className="card ad-empty" role="alert">
              <div className="ad-empty-icon" aria-hidden="true">🔍</div>
              <strong>We can&apos;t find that person</strong>
              <span>They may have been removed, or they don&apos;t belong to your restaurant.</span>
              <Link href="/owner/staff" className="btn btn-primary">Back to the team</Link>
            </div>
          );
        }
        return <Editor key={m.id} member={m} members={data} />;
      }}
    </QueryGate>
  );
}
