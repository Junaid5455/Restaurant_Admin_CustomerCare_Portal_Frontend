'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from './settings-shell';
import { PasswordCard } from './profile-view';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/api/auth';
import { parseError } from '@/lib/errors';

function memberSince(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function SettingsAccountView() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { push } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function resend() {
    setSending(true);
    setSendError(null);
    try {
      await authApi.requestVerification();
      setSent(true);
      push('Verification email sent');
    } catch (e) {
      setSendError(parseError(e).display);
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    await logout();
    router.replace('/login');
  }

  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '';
  const since = memberSince(user?.date_joined);

  return (
    <SettingsShell active="account">
      <section className="card sv-acct-card" aria-labelledby="a-signin">
        <div className="sv-acct-rowhead">
          <h2 id="a-signin" className="sv-acct-h">Sign-in details</h2>
          <Link href="/customer/profile" className="sv-link-btn">Edit profile</Link>
        </div>

        <dl className="sv-facts">
          <div>
            <dt>Email</dt>
            <dd>
              {user?.email}
              {user?.email_verified === true && <span className="badge badge-good">Verified</span>}
              {user?.email_verified === false && <span className="badge badge-warn">Not verified</span>}
            </dd>
          </div>
          {name && (
            <div><dt>Name</dt><dd>{name}</dd></div>
          )}
          <div><dt>Phone</dt><dd>{user?.phone || <span className="sv-acct-note">Not added</span>}</dd></div>
          {since && <div><dt>Member since</dt><dd>{since}</dd></div>}
        </dl>

        {user?.email_verified === false && (
          <>
            <p className="sv-acct-note">
              Verify your email so we can reach you about orders and help you recover your account.
            </p>
            {sendError && <Alert>{sendError}</Alert>}
            {sent ? (
              <Alert kind="success">We sent a new link to {user.email}. It can take a minute to arrive.</Alert>
            ) : (
              <div className="sv-acct-actions">
                <Button variant="ghost" loading={sending} loadingText="Sending…" onClick={resend}>
                  Send verification email
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <PasswordCard />

      <section className="card sv-acct-card" aria-labelledby="a-out">
        <h2 id="a-out" className="sv-acct-h">Sign out</h2>
        <p className="sv-acct-note">Ends your session on this device. Your cart and saved details stay on your account.</p>
        <div className="sv-acct-actions">
          <Button variant="ghost" loading={signingOut} loadingText="Signing out…" onClick={signOut}>Sign out</Button>
        </div>
      </section>
    </SettingsShell>
  );
}
