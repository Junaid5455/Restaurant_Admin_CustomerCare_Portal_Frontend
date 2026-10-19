'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SafeImage } from '@/components/ui/safe-image';
import { useAuth } from '@/context/auth-context';
import { accountApi } from '@/lib/api/account';
import { initials } from '@/lib/format';

export type AccountSection = 'profile' | 'addresses' | 'payments' | 'favorites' | 'rewards' | 'orders';

const TABS: { id: AccountSection; href: string; icon: string; text: string }[] = [
  { id: 'profile', href: '/customer/profile', icon: '👤', text: 'Profile' },
  { id: 'addresses', href: '/customer/addresses', icon: '📍', text: 'Addresses' },
  { id: 'payments', href: '/customer/payment-methods', icon: '💳', text: 'Payment methods' },
  { id: 'favorites', href: '/customer/favorites', icon: '❤️', text: 'Favorites' },
  { id: 'rewards', href: '/customer/rewards', icon: '🎁', text: 'Rewards' },
  { id: 'orders', href: '/customer/orders', icon: '📋', text: 'Order history' },
];

export const REWARDS_KEY = ['rewards'] as const;

/** Shared frame for every "My account" page: who you are, where you can go, then the page itself. */
export function AccountShell({
  active,
  title,
  description,
  actions,
  children,
}: {
  active: AccountSection;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  // Same key as the Rewards page, so this costs nothing extra there. Failure just hides the chips.
  const rewards = useQuery({ queryKey: REWARDS_KEY, queryFn: accountApi.rewards, staleTime: 60_000, retry: false });

  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email : '';

  return (
    <>
      <section className="card sv-acct-head" aria-label="Your account">
        <div className="sv-acct-avatar" aria-hidden="true">
          <SafeImage src={user?.profile_picture} alt="" fallback={<span>{initials(name) || '?'}</span>} />
        </div>
        <div className="sv-acct-who">
          <div className="sv-acct-name">{name || ' '}</div>
          {user && name !== user.email && <div className="sv-acct-email">{user.email}</div>}
        </div>
        {rewards.data && (
          <div className="sv-acct-chips">
            <span className="badge badge-warn">⭐ {rewards.data.loyalty_points.toLocaleString('en-US')} points</span>
            <span className="badge badge-accent">
              {rewards.data.total_orders} {rewards.data.total_orders === 1 ? 'order' : 'orders'}
            </span>
          </div>
        )}
      </section>

      <nav className="sv-acct-tabs" aria-label="Account sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={`sv-acct-tab ${t.id === active ? 'active' : ''}`}
            aria-current={t.id === active ? 'page' : undefined}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.text}
          </Link>
        ))}
      </nav>

      <div className="sv-page-head sv-acct-pagehead">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>

      {children}
    </>
  );
}

export function SectionSkeleton({ rows = 2, height = 110 }: { rows?: number; height?: number }) {
  return (
    <div className="sv-acct-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sv-skel" style={{ height, borderRadius: 16 }} />
      ))}
    </div>
  );
}
