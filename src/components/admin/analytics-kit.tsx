'use client';

import './analytics.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/submit-button';
import { parseError } from '@/lib/errors';
import { percentChange } from '@/lib/analytics';

type Active = 'sales' | 'orders' | 'products' | 'customers' | 'reports';

export function AnalyticsFrame({ active, title, description, actions, children }: { active: Active; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const tabs: { id: Active; href: string; icon: string; text: string }[] = [
    { id: 'sales', href: '/owner/analytics', icon: '💰', text: 'Sales' },
    { id: 'orders', href: '/owner/analytics/orders', icon: '📋', text: 'Orders' },
    { id: 'products', href: '/owner/analytics/products', icon: '🍽', text: 'Products' },
    { id: 'customers', href: '/owner/analytics/customers', icon: '👥', text: 'Customers' },
    { id: 'reports', href: '/owner/analytics/reports', icon: '⬇', text: 'Reports' },
  ];
  return (
    <>
      <nav className="ad-tabs an-noprint" aria-label="Analytics sections">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} className={`ad-tab ${t.id === active ? 'active' : ''}`} aria-current={t.id === active ? 'page' : undefined}>
            <span aria-hidden="true">{t.icon}</span>
            {t.text}
          </Link>
        ))}
      </nav>
      <div className="ad-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="ad-head-actions an-noprint">{actions}</div>}
      </div>
      <div className="ad-stack">{children}</div>
    </>
  );
}

/** A segmented choice, e.g. 7 / 14 / 30 days. */
export function RangeChips<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="an-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "▲ 12% vs the 7 days before", or a plain note when there is nothing to compare with. */
export function Delta({ now, before, versus }: { now: number; before: number | null; versus: string }) {
  if (before === null) return <span>{versus}</span>;
  const pct = percentChange(now, before);
  if (pct === null) return <span>{now > 0 ? 'Nothing to compare with yet' : 'No sales in either period'}</span>;
  if (pct === 0) return <span>Same as {versus}</span>;
  const up = pct > 0;
  return (
    <span>
      <span className={`ad-delta ${up ? 'up' : 'down'}`}>
        <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(pct)}%
        <span className="sr-only">{up ? ' up' : ' down'}</span>
      </span>{' '}
      vs {versus}
    </span>
  );
}

export function Kpi({ tone, icon, label, value, sub, loading }: { tone: 'violet' | 'coral' | 'teal' | 'yellow'; icon: string; label: string; value: string | null; sub?: ReactNode; loading?: boolean }) {
  return (
    <div className={`card ad-kpi is-${tone}`} role="group" aria-label={label}>
      <div className="ad-kpi-top">
        <div className="ad-kpi-label">{label}</div>
        <div className="ad-kpi-icon" aria-hidden="true">{icon}</div>
      </div>
      {loading ? (
        <>
          <div className="ad-skel" style={{ height: 34, width: '60%' }} aria-hidden="true" />
          <div className="ad-skel" style={{ height: 14, width: '80%' }} aria-hidden="true" />
        </>
      ) : (
        <>
          <div className={`ad-kpi-value ${value === null ? 'ad-kpi-na' : ''}`}>{value ?? '—'}</div>
          <div className="ad-kpi-sub">{value === null ? "Couldn't load this" : sub}</div>
        </>
      )}
    </div>
  );
}

/** A titled card; shows a skeleton while loading and a retry when the request failed. */
export function Panel({
  title, subtitle, actions, query, children, empty, className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  query?: Pick<UseQueryResult<unknown>, 'isPending' | 'isError' | 'error' | 'refetch'>;
  children?: ReactNode;
  /** When set, shown instead of the children (e.g. "no orders yet"). */
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ad-card-pad ${className ?? ''}`} aria-label={title}>
      <div className="an-panel-head">
        <div>
          <h2 className="ad-card-title">{title}</h2>
          {subtitle && <p className="an-sub">{subtitle}</p>}
        </div>
        {actions && <div className="an-noprint">{actions}</div>}
      </div>
      {query?.isPending ? (
        <div aria-busy="true" aria-label="Loading">
          <div className="ad-skel" style={{ height: 180, borderRadius: 12 }} />
        </div>
      ) : query?.isError ? (
        <div className="ad-empty" role="alert">
          <strong>We couldn&apos;t load this</strong>
          <span>{parseError(query.error).display}</span>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : empty ? (
        <div className="ad-empty">{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}

/** A short notice about where a number comes from. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="an-note">{children}</p>;
}
