'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { homeForRole } from '@/lib/roles';

/** Client-side guard behind the middleware: waits for the session, then enforces the role's own area. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === 'authenticated' && user) {
      const home = homeForRole(user.role);
      if (pathname !== home && !pathname.startsWith(home + '/')) router.replace(home);
    }
  }, [status, user, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner spinner-lg" role="status" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
