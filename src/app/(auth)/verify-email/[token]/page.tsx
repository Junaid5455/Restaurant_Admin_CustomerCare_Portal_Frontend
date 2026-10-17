'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/api/auth';
import { parseError } from '@/lib/errors';
import { homeForRole } from '@/lib/roles';

type State = { kind: 'verifying' } | { kind: 'success' } | { kind: 'error'; message: string };

export default function VerifyEmailTokenPage() {
  const { token } = useParams<{ token: string }>();
  const { user, status, refreshUser } = useAuth();
  const [state, setState] = useState<State>({ kind: 'verifying' });
  // Tokens are single-use. React StrictMode runs effects twice in dev, which would burn the token
  // on the first call and show "already used" on the second, so guard to one request.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        await authApi.verifyEmail(token);
        setState({ kind: 'success' });
        void refreshUser();
      } catch (e) {
        const err = parseError(e);
        setState({ kind: 'error', message: err.fieldErrors.token ?? err.display });
      }
    })();
  }, [token, refreshUser]);

  const signedIn = status === 'authenticated' && !!user;

  return (
    <AuthShell title="Email verification">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {state.kind === 'verifying' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '12px 0' }}>
            <span className="spinner spinner-lg" role="status" aria-label="Verifying" />
            <p style={{ color: 'var(--fg-2)' }}>Verifying your email…</p>
          </div>
        )}

        {state.kind === 'success' && (
          <>
            <Alert kind="success">Your email is verified. Thanks for confirming.</Alert>
            {signedIn ? (
              <Link href={homeForRole(user.role)} className="btn btn-primary btn-block">
                Go to dashboard
              </Link>
            ) : (
              <Link href="/login" className="btn btn-primary btn-block">
                Sign in
              </Link>
            )}
          </>
        )}

        {state.kind === 'error' && (
          <>
            <Alert>{state.message}</Alert>
            <Link href="/verify-email" className="btn btn-primary btn-block">
              Request a new link
            </Link>
            <Link href={signedIn ? homeForRole(user.role) : '/login'} className="link" style={{ textAlign: 'center' }}>
              {signedIn ? 'Go to dashboard' : 'Back to sign in'}
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
