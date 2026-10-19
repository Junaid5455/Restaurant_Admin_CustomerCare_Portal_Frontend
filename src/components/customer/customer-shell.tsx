'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SearchBox } from './search-box';
import { SafeImage } from '@/components/ui/safe-image';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/hooks/use-cart';
import { cartCount } from '@/lib/api/cart';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

/** Flip `ready` to true as each page gets built; unfinished entries render as disabled "Soon" items. */
const NAV = [
  {
    label: 'Discover',
    items: [{ href: '/customer/restaurants', icon: '🍽', text: 'Restaurants', ready: true }],
  },
  {
    label: 'Orders',
    items: [
      { href: '/customer/cart', icon: '🛒', text: 'Cart', ready: true },
      { href: '/customer/orders', icon: '📋', text: 'My orders', ready: true },
      { href: '/customer/reservations', icon: '📅', text: 'Reservations', ready: false },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/customer/profile', icon: '👤', text: 'Profile', ready: true },
      { href: '/customer/addresses', icon: '📍', text: 'Addresses', ready: true },
      { href: '/customer/payment-methods', icon: '💳', text: 'Payment methods', ready: true },
      { href: '/customer/favorites', icon: '❤️', text: 'Favorites', ready: true },
      { href: '/customer/rewards', icon: '🎁', text: 'Rewards', ready: true },
      { href: '/customer/support', icon: '🎫', text: 'Support', ready: false },
    ],
  },
];

const CART_HREF = '/customer/cart';
const CART_READY = true;

function titleFor(pathname: string) {
  if (/^\/customer\/orders\/.+\/track/.test(pathname)) return 'Track order';
  if (/^\/customer\/orders\/.+/.test(pathname)) return 'Order details';
  if (pathname.startsWith('/customer/orders')) return 'My orders';
  if (pathname.startsWith('/customer/profile')) return 'Profile';
  if (pathname.startsWith('/customer/addresses')) return 'Saved addresses';
  if (pathname.startsWith('/customer/payment-methods')) return 'Payment methods';
  if (pathname.startsWith('/customer/favorites')) return 'Favorites';
  if (pathname.startsWith('/customer/rewards')) return 'Rewards';
  if (pathname.startsWith('/customer/cart')) return 'Your cart';
  if (pathname.startsWith('/customer/checkout/confirmation')) return 'Order confirmation';
  if (pathname.startsWith('/customer/checkout/payment')) return 'Payment';
  if (pathname.startsWith('/customer/checkout')) return 'Checkout';
  if (/^\/customer\/restaurants\/.+/.test(pathname)) return 'Restaurant';
  if (pathname.startsWith('/customer/restaurants')) return 'Discover restaurants';
  return 'Savoria';
}

export function CustomerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { push } = useToast();
  const cart = useCart();
  const [navOpen, setNavOpen] = useState(false);

  const count = cartCount(cart.data);
  const displayName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email : '';

  // Close the mobile drawer after navigating.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="sv-shell">
      {navOpen && <div className="sv-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <nav className={`sv-sidebar ${navOpen ? 'open' : ''}`} aria-label="Main">
        <div className="sv-sidebar-brand">
          <div className="brand-logo">
            <div className="brand-icon" aria-hidden="true">🍽</div>
            <div>
              <div className="brand-name">Savoria</div>
              <div className="brand-sub">Customer Portal</div>
            </div>
          </div>
        </div>

        {NAV.map((section) => (
          <div className="sv-nav-section" key={section.label}>
            <div className="sv-nav-label">{section.label}</div>
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + '/') ||
                (item.href === CART_HREF && pathname.startsWith('/customer/checkout'));
              return item.ready ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sv-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="sv-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.text}</span>
                </Link>
              ) : (
                <span key={item.href} className="sv-nav-item disabled" aria-disabled="true">
                  <span className="sv-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.text}</span>
                  <span className="sv-soon">Soon</span>
                </span>
              );
            })}
          </div>
        ))}

        <div className="sv-sidebar-footer">
          <div className="sv-user-pill">
            <div className="sv-avatar" aria-hidden="true">
              <SafeImage src={user?.profile_picture} alt="" fallback={<>{initials(displayName) || '?'}</>} />
            </div>
            <div className="sv-user-text">
              <div className="sv-user-name">{displayName}</div>
              <div className="sv-user-role">{user ? ROLE_LABEL[user.role] : ''}</div>
            </div>
          </div>
          <button
            type="button"
            className="sv-signout"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="sv-main">
        <header className="sv-topbar">
          <button
            type="button"
            className="icon-btn sv-burger"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <div className="sv-title">{titleFor(pathname)}</div>
          <Suspense fallback={<div className="sv-search" />}>
            <SearchBox />
          </Suspense>
          <div className="sv-topbar-actions">
            <ThemeToggle />
            {CART_READY ? (
              <Link href={CART_HREF} className="icon-btn sv-cart" aria-label={`Cart, ${count} items`}>
                <span aria-hidden="true">🛒</span>
                {count > 0 && <span className="sv-cart-count">{count}</span>}
              </Link>
            ) : (
              <button
                type="button"
                className="icon-btn sv-cart"
                aria-label={`Cart, ${count} items`}
                title="The cart page arrives in the next step"
                onClick={() => push('The cart page arrives in the next step.', 'info')}
              >
                <span aria-hidden="true">🛒</span>
                {count > 0 && <span className="sv-cart-count">{count}</span>}
              </button>
            )}
          </div>
        </header>

        <main className="sv-content" id="main">
          <div className="sv-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
