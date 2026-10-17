'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/submit-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/context/auth-context';
import { ROLE_LABEL } from '@/lib/roles';

/** Temporary landing page for each role until its dashboard is built in a later step. */
export function RoleHome({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge" style={{ color: 'var(--violet)', background: 'var(--violet-dim)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            {ROLE_LABEL[user.role]}
          </span>
          <ThemeToggle />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>{title}</h1>
        <p style={{ color: 'var(--fg-2)' }}>
          Signed in as <strong style={{ color: 'var(--fg)' }}>{name}</strong> ({user.email}). The full dashboard arrives in the next steps.
        </p>
        {user.email_verified === false && (
          <p className="alert alert-info">
            Your email isn't verified yet.&nbsp;
            <Link href="/verify-email" className="link">
              Verify now
            </Link>
          </p>
        )}
        <Button
          variant="ghost"
          onClick={async () => {
            await logout();
            router.replace('/login');
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
