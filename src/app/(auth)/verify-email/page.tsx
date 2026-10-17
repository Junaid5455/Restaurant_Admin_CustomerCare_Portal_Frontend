'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/api/auth';
import { parseError } from '@/lib/errors';
import { homeForRole } from '@/lib/roles';

const COOLDOWN = 60;

function PendingVerification() {
  const params = useSearchParams();
  const { user, status } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const signedIn = status === 'authenticated' && !!user;
  const welcome = params.get('welcome');

  async function resend() {
    setError(null);
    setEmailError(undefined);

    if (!signedIn) {
      const value = email.trim();
      if (!/^\S+@\S+\.\S+$/.test(value)) {
        setEmailError('Enter a valid email address');
        return;
      }
    }

    setBusy(true);
    try {
      if (signedIn) await authApi.requestVerification();
      else await authApi.sendVerification(email.trim());
      setSent(true);
      setCooldown(COOLDOWN);
    } catch (e) {
      const err = parseError(e);
      // Unknown address ("User not found"): same neutral outcome as success, so we don't reveal accounts.
      if (!signedIn && err.status === 404) {
        setSent(true);
        setCooldown(COOLDOWN);
      } else {
        setError(err.display);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={welcome ? 'Welcome to Savoria' : 'Verify your email'}
      subtitle={
        signedIn ? (
          <>
            We sent a verification link to <strong>{user.email}</strong>. It's valid for 24 hours.
          </>
        ) : (
          'Open the link in your verification email, or request a new one below.'
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sent && <Alert kind="success">Verification email sent. Check your inbox (and spam folder).</Alert>}
        {error && <Alert>{error}</Alert>}

        {status === 'loading' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <span className="spinner spinner-lg" role="status" aria-label="Loading" />
          </div>
        ) : (
          <>
            {!signedIn && (
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={emailError}
              />
            )}
            <Button
              variant={signedIn ? 'ghost' : 'primary'}
              block
              onClick={resend}
              loading={busy}
              loadingText="Sending…"
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend available in ${cooldown}s` : sent ? 'Resend email' : 'Send verification email'}
            </Button>
          </>
        )}

        {signedIn ? (
          <Link href={homeForRole(user.role)} className="btn btn-primary btn-block">
            Continue to dashboard
          </Link>
        ) : (
          status === 'anonymous' && (
            <Link href="/login" className="link" style={{ textAlign: 'center' }}>
              Back to sign in
            </Link>
          )
        )}
        {signedIn && <p className="field-hint" style={{ textAlign: 'center' }}>You can verify later; you won't lose access.</p>}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense>
      <PendingVerification />
    </Suspense>
  );
}
