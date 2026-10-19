'use client';

import Link from 'next/link';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccountShell, SectionSkeleton } from './account-shell';
import { Alert } from '@/components/ui/alert';
import { PasswordField, TextField } from '@/components/ui/text-field';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { accountApi, type ProfileInput } from '@/lib/api/account';
import { ordersApi } from '@/lib/api/orders';
import { ApiError, parseError } from '@/lib/errors';
import { formatMoney, initials } from '@/lib/format';
import { STATUS_LABEL, statusBadgeClass } from '@/lib/order-status';
import { formatDateTime } from '@/lib/pickup';
import type { User } from '@/lib/types';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function fromUser(u: User): ProfileInput {
  return { first_name: u.first_name ?? '', last_name: u.last_name ?? '', email: u.email, phone: u.phone ?? '' };
}

/* ───────────── Photo ───────────── */

function PhotoCard({ user }: { user: User }) {
  const { refreshUser } = useAuth();
  const { push } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again after an error
    if (!file) return;
    setError(null);
    if (!PHOTO_TYPES.includes(file.type)) return setError('Choose a JPG, PNG, WebP or GIF image.');
    if (file.size > MAX_PHOTO_BYTES) return setError('That image is larger than 5 MB. Choose a smaller one.');

    setBusy(true);
    try {
      const updated = await accountApi.updatePicture(file);
      // The server answers 200 even if it ignored the file, so check that the picture really changed.
      if (!updated.profile_picture || updated.profile_picture === user.profile_picture) {
        setError("Your photo couldn't be saved right now. Please try again later.");
        return;
      }
      await refreshUser();
      push('Profile photo updated');
    } catch (err) {
      setError(parseError(err).display);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card sv-acct-card" aria-labelledby="photo-h">
      <h2 id="photo-h" className="sv-acct-h">Profile photo</h2>
      <div className="sv-photo">
        <div className="sv-photo-img">
          <SafeImage src={user.profile_picture} alt={`${name}'s profile photo`} fallback={<span aria-hidden="true">{initials(name) || '?'}</span>} />
        </div>
        <div className="sv-photo-actions">
          <input ref={input} type="file" accept={PHOTO_TYPES.join(',')} hidden onChange={onPick} aria-label="Choose a profile photo" />
          <Button variant="ghost" loading={busy} loadingText="Uploading…" onClick={() => input.current?.click()}>
            {user.profile_picture ? 'Change photo' : 'Upload a photo'}
          </Button>
          <p className="sv-acct-note">JPG, PNG, WebP or GIF · up to 5 MB</p>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
    </section>
  );
}

/* ───────────── Personal details ───────────── */

function DetailsCard({ user }: { user: User }) {
  const { refreshUser } = useAuth();
  const { push } = useToast();
  const [baseline, setBaseline] = useState<ProfileInput>(() => fromUser(user));
  const [values, setValues] = useState<ProfileInput>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = (Object.keys(values) as (keyof ProfileInput)[]).some((k) => values[k].trim() !== baseline[k].trim());
  const emailChanged = values.email.trim().toLowerCase() !== baseline.email.trim().toLowerCase();

  const set = (key: keyof ProfileInput) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: '' }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const email = values.email.trim();
    const phone = values.phone.trim();
    if (!email) next.email = 'Enter your email address';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address';
    if (values.first_name.trim().length > 150) next.first_name = 'Too long';
    if (values.last_name.trim().length > 150) next.last_name = 'Too long';
    if (phone && !/^[+\d][\d\s-]*$/.test(phone)) next.phone = 'Use digits only (a leading + is fine)';
    else if (phone.length > 15) next.phone = 'Phone numbers can be at most 15 characters';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const updated = await accountApi.updateProfile(values);
      const fresh = fromUser(updated);
      setBaseline(fresh);
      setValues(fresh);
      await refreshUser();
      push('Profile saved');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : parseError(err);
      setErrors(apiErr.fieldErrors);
      if (!Object.keys(apiErr.fieldErrors).length) setFormError(apiErr.display);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sv-acct-card" onSubmit={submit} noValidate aria-labelledby="details-h">
      <h2 id="details-h" className="sv-acct-h">Personal details</h2>
      <div className="sv-two">
        <TextField label="First name" value={values.first_name} onChange={set('first_name')} error={errors.first_name} autoComplete="given-name" maxLength={150} />
        <TextField label="Last name" value={values.last_name} onChange={set('last_name')} error={errors.last_name} autoComplete="family-name" maxLength={150} />
      </div>
      <TextField
        label="Email"
        type="email"
        value={values.email}
        onChange={set('email')}
        error={errors.email}
        autoComplete="email"
        hint={emailChanged ? 'This is the address you sign in with, so use the new one next time you log in.' : undefined}
      />
      <TextField
        label="Phone"
        type="tel"
        value={values.phone}
        onChange={set('phone')}
        error={errors.phone}
        autoComplete="tel"
        optional
        maxLength={15}
      />
      {formError && <Alert>{formError}</Alert>}
      <div className="sv-acct-actions">
        <Button type="submit" loading={busy} loadingText="Saving…" disabled={!dirty}>Save changes</Button>
        {dirty && !busy && (
          <Button type="button" variant="ghost" onClick={() => { setValues(baseline); setErrors({}); setFormError(null); }}>
            Discard
          </Button>
        )}
      </div>
    </form>
  );
}

/* ───────────── Password ───────────── */

const EMPTY_PW = { old: '', next: '', confirm: '' };

function PasswordCard() {
  const { push } = useToast();
  const [values, setValues] = useState(EMPTY_PW);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY_PW) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: '' }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!values.old) next.old = 'Enter your current password';
    if (values.next.length < 8) next.next = 'Use at least 8 characters';
    else if (values.next === values.old) next.next = 'Choose a password different from your current one';
    if (values.confirm !== values.next) next.confirm = "Passwords don't match";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await accountApi.changePassword(values.old, values.next, values.confirm);
      setValues(EMPTY_PW);
      push('Password changed');
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : parseError(err);
      const f = apiErr.fieldErrors;
      setErrors({ old: f.old_password ?? '', next: f.new_password ?? '', confirm: f.new_password_confirm ?? '' });
      const mapped = f.old_password || f.new_password || f.new_password_confirm;
      if (!mapped) setFormError(apiErr.display);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sv-acct-card" onSubmit={submit} noValidate aria-labelledby="pw-h">
      <h2 id="pw-h" className="sv-acct-h">Change password</h2>
      <PasswordField label="Current password" value={values.old} onChange={set('old')} error={errors.old} autoComplete="current-password" />
      <div className="sv-two">
        <PasswordField label="New password" value={values.next} onChange={set('next')} error={errors.next} autoComplete="new-password" hint="At least 8 characters" />
        <PasswordField label="Confirm new password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
      </div>
      {formError && <Alert>{formError}</Alert>}
      <div className="sv-acct-actions">
        <Button type="submit" loading={busy} loadingText="Updating…" disabled={!values.old && !values.next && !values.confirm}>
          Update password
        </Button>
      </div>
    </form>
  );
}

/* ───────────── Recent orders ───────────── */

function RecentOrders() {
  const q = useQuery({ queryKey: ['orders', 'recent'], queryFn: () => ordersApi.list({ page: 1, page_size: 3 }), staleTime: 30_000 });

  return (
    <section className="card sv-acct-card" aria-labelledby="recent-h">
      <div className="sv-acct-rowhead">
        <h2 id="recent-h" className="sv-acct-h">Recent orders</h2>
        <Link href="/customer/orders" className="link">View all</Link>
      </div>
      {q.isPending ? (
        <div className="sv-skel" style={{ height: 96 }} aria-busy="true" aria-label="Loading recent orders" />
      ) : q.isError ? (
        <div className="sv-acct-inline">
          <Alert>{parseError(q.error).display}</Alert>
          <Button variant="ghost" onClick={() => q.refetch()}>Try again</Button>
        </div>
      ) : q.data.orders.length === 0 ? (
        <p className="sv-acct-note">No orders yet. <Link href="/customer/restaurants" className="link">Find something to eat</Link></p>
      ) : (
        <ul className="sv-recent">
          {q.data.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/customer/orders/${o.id}`}>
                <span className="r-main">
                  <strong>{o.restaurant_name}</strong>
                  <small>#{o.order_number} · {formatDateTime(o.created_at)}</small>
                </span>
                <span className="r-side">
                  <span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span>
                  <strong>{formatMoney(o.total_amount)}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────── Page ───────────── */

export function ProfileView() {
  const { user } = useAuth();
  return (
    <AccountShell active="profile" title="Profile" description="Keep your details up to date so deliveries and receipts reach you.">
      {!user ? (
        <SectionSkeleton rows={3} height={150} />
      ) : (
        <div className="sv-acct-grid">
          <div className="sv-acct-col">
            <PhotoCard user={user} />
            <DetailsCard user={user} />
            <PasswordCard />
          </div>
          <div className="sv-acct-col">
            <RecentOrders />
          </div>
        </div>
      )}
    </AccountShell>
  );
}
