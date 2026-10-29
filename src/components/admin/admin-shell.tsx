'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SafeImage } from '@/components/ui/safe-image';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/context/auth-context';
import { initials } from '@/lib/format';
import { ADMIN_LOGIN, ROLE_LABEL } from '@/lib/roles';

interface NavItem {
  href: string;
  icon: string;
  text: string;
  /** Flip to true as each page gets built; unfinished entries render as disabled "Soon" items. */
  ready: boolean;
}

export const ADMIN_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/owner', icon: '⊞', text: 'Dashboard', ready: true },
      { href: '/owner/tickets', icon: '🎫', text: 'Tickets', ready: true },
    ],
  },
  {
    label: 'Restaurant',
    items: [
      { href: '/owner/orders', icon: '📋', text: 'Orders', ready: true },
      { href: '/owner/menu', icon: '🍕', text: 'Menu', ready: true },
      { href: '/owner/kitchen', icon: '🍳', text: 'Kitchen display', ready: true },
      { href: '/owner/deliveries', icon: '🛵', text: 'Deliveries', ready: true },
      { href: '/owner/reservations', icon: '📅', text: 'Reservations', ready: true },
      { href: '/owner/reviews', icon: '⭐', text: 'Reviews', ready: false },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/owner/staff', icon: '👥', text: 'Staff', ready: true },
      { href: '/owner/analytics', icon: '📊', text: 'Analytics', ready: true },
      { href: '/owner/settings', icon: '⚙️', text: 'Settings', ready: true },
    ],
  },
];

/** The platform team's menu. Every entry is live. */
export const SUPER_NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Platform',
    items: [
      { href: '/admin', icon: '⊞', text: 'Overview', ready: true },
      { href: '/admin/restaurants', icon: '🏪', text: 'Restaurants', ready: true },
      { href: '/admin/customers', icon: '👥', text: 'People', ready: true },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/admin/revenue', icon: '💰', text: 'Revenue', ready: true },
      { href: '/admin/analytics', icon: '📊', text: 'Analytics', ready: true },
      { href: '/admin/support', icon: '🎫', text: 'Support', ready: true },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  href === '/owner' || href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

function titleFor(pathname: string, nav = ADMIN_NAV) {
  for (const s of nav) for (const i of s.items) if (isActive(pathname, i.href)) return i.text;
  return 'Dashboard';
}

export function AdminShell({ children, area = 'owner' }: { children: ReactNode; area?: 'owner' | 'platform' }) {
  const nav = area === 'platform' ? SUPER_NAV : ADMIN_NAV;
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email : '';

  // Close the mobile drawer after navigating, and on Escape.
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="ad-shell">
      {navOpen && <div className="ad-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <nav className={`ad-sidebar ${navOpen ? 'open' : ''}`} aria-label="Admin">
        <div className="ad-sidebar-brand">
          <div className="brand-logo">
            <div className="brand-icon" aria-hidden="true">🍽</div>
            <div>
              <div className="brand-name">Savoria</div>
              <div className="brand-sub">{area === 'platform' ? 'Platform Admin' : 'Restaurant Admin'}</div>
            </div>
          </div>
        </div>

        {nav.map((section) => (
          <div className="ad-nav-section" key={section.label}>
            <div className="ad-nav-label">{section.label}</div>
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return item.ready ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ad-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="ad-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.text}</span>
                </Link>
              ) : (
                <span key={item.href} className="ad-nav-item disabled" aria-disabled="true">
                  <span className="ad-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.text}</span>
                  <span className="ad-soon">Soon</span>
                </span>
              );
            })}
          </div>
        ))}

        <div className="ad-sidebar-footer">
          <div className="ad-user-pill">
            <div className="ad-avatar" aria-hidden="true">
              <SafeImage src={user?.profile_picture} alt="" fallback={<>{initials(displayName) || '?'}</>} />
            </div>
            <div className="ad-user-text">
              <div className="ad-user-name">{displayName}</div>
              <div className="ad-user-role">{user ? ROLE_LABEL[user.role] : ''}</div>
            </div>
          </div>
          <button
            type="button"
            className="ad-signout"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await logout();
              router.replace(ADMIN_LOGIN);
            }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </nav>

      <div className="ad-main">
        <header className="ad-topbar">
          <button
            type="button"
            className="icon-btn ad-burger"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <div className="ad-title">{titleFor(pathname, nav)}</div>
          <div className="ad-topbar-actions">
            <ThemeToggle />
          </div>
        </header>

        <main className="ad-content" id="main">
          <div className="ad-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
