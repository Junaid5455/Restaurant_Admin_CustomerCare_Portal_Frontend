'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { parseError } from '@/lib/errors';
import { RESTAURANT_SETTINGS_SECTIONS, type RestaurantSettingsSection } from '@/lib/restaurant-settings-sections';

/** Tabs + page heading shared by the four restaurant settings pages. */
export function SettingsFrame({ active, children }: { active: RestaurantSettingsSection; children: ReactNode }) {
  const current = RESTAURANT_SETTINGS_SECTIONS.find((s) => s.id === active) ?? RESTAURANT_SETTINGS_SECTIONS[0];
  return (
    <>
      <nav className="ad-tabs" aria-label="Restaurant settings sections">
        {RESTAURANT_SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/owner/settings/${s.id}`}
            className={`ad-tab ${s.id === active ? 'active' : ''}`}
            aria-current={s.id === active ? 'page' : undefined}
          >
            <span aria-hidden="true">{s.icon}</span>
            {s.text}
          </Link>
        ))}
      </nav>
      <div className="ad-head">
        <div>
          <h1>{current.title}</h1>
          <p>{current.description}</p>
        </div>
      </div>
      <div className="ad-stack">{children}</div>
    </>
  );
}

/** Shows a skeleton while loading, a retry card on failure, and `children(data)` otherwise. */
export function QueryGate<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="ad-skel" style={{ height: 220, borderRadius: 16, marginBottom: 16 }} />
        <div className="ad-skel" style={{ height: 180, borderRadius: 16 }} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="card ad-empty" role="alert">
        <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
        <strong>We couldn&apos;t load this</strong>
        <span>{parseError(query.error).display}</span>
        <Button onClick={() => query.refetch()}>Try again</Button>
      </div>
    );
  }
  return <>{children(query.data as T)}</>;
}

/** Save / Discard row for a section. Save stays disabled until something changed. */
export function SaveBar({
  dirty, busy, error, onDiscard, saveLabel = 'Save changes',
}: {
  dirty: boolean;
  busy: boolean;
  error?: string | null;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  return (
    <>
      {error && <Alert>{error}</Alert>}
      <div className="ad-actions">
        <Button type="submit" loading={busy} loadingText="Saving…" disabled={!dirty}>{saveLabel}</Button>
        {dirty && !busy && (
          <Button type="button" variant="ghost" onClick={onDiscard}>Discard changes</Button>
        )}
        {dirty && !busy && <span className="ad-note" role="status">You have unsaved changes</span>}
      </div>
    </>
  );
}

/** Turns a failed save into per-field messages plus one general message for anything else. */
export function mapSaveError(e: unknown, fields: string[]): { fields: Record<string, string>; form: string | null } {
  const err = parseError(e);
  const out: Record<string, string> = {};
  let mapped = false;
  for (const f of fields) {
    if (err.fieldErrors[f]) {
      out[f] = err.fieldErrors[f];
      mapped = true;
    }
  }
  return { fields: out, form: mapped ? null : err.display };
}
