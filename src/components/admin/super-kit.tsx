'use client';

import './super.css';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/submit-button';
import { parseError } from '@/lib/errors';
import type { UseQueryResult } from '@tanstack/react-query';

export function PageHead({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="ad-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="ad-head-actions">{actions}</div>}
    </div>
  );
}

/** A card-sized error with a retry, for a page whose main list could not load. */
export function LoadError({ query, what }: { query: Pick<UseQueryResult<unknown>, 'error' | 'refetch'>; what: string }) {
  return (
    <div className="card ad-empty" role="alert">
      <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
      <strong>We couldn&apos;t load {what}</strong>
      <span>{parseError(query.error).display}</span>
      <Button onClick={() => void query.refetch()}>Try again</Button>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card" aria-busy="true" aria-label="Loading" style={{ padding: 16 }}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="ad-skel" style={{ height: 44, marginBottom: i === rows - 1 ? 0 : 10 }} />)}
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? 'badge-good' : 'badge-crit'}`}>{active ? 'Active' : 'Inactive'}</span>;
}

/** "Oct 24, 2026", or an em dash when the API didn't send a date. */
export function dateOnly(iso?: string | null): string {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ad-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`ad-chip ${value === o.id ? 'active' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
          {o.count !== undefined && <span className="su-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
