'use client';

import { Fragment, useMemo, useState } from 'react';
import { StaffFrame } from './staff-kit';
import { Button } from '@/components/ui/submit-button';
import { activityUnavailable, useActivity, useStaff } from '@/hooks/use-admin-staff';
import { parseError } from '@/lib/errors';
import { ACTIVITY_CATEGORIES, categoryIcon, dayLabel } from '@/lib/staff';
import { roleLabel } from '@/lib/staff';

export function StaffActivityView() {
  const staff = useStaff();
  const [actor, setActor] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filters = useMemo(() => ({ actor: actor || undefined, category: category || undefined, date_from: from || undefined, date_to: to || undefined }), [actor, category, from, to]);
  const q = useActivity(filters);
  const filtersActive = !!(actor || category || from || to);
  const badRange = !!from && !!to && from > to;

  const entries = q.data?.pages.flatMap((p) => p.entries) ?? [];
  // Group by day, in the order the server sent them (newest first).
  const days: { label: string; rows: typeof entries }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.created_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(e);
    else days.push({ label, rows: [e] });
  }

  const unavailable = q.isError && activityUnavailable(q.error);

  return (
    <StaffFrame active="activity" title="Activity" description="Who did what in your restaurant, newest first.">
      {unavailable ? (
        <div className="card ad-empty" role="status">
          <div className="ad-empty-icon" aria-hidden="true">🕘</div>
          <strong>The activity log isn&apos;t set up on your server yet</strong>
          <span>Your server doesn&apos;t record staff activity yet, so there is nothing to show. The step 7.6 backend notes explain what to add; this page starts working as soon as it exists.</span>
        </div>
      ) : (
        <>
          <div className="ad-filterbar" role="group" aria-label="Filter activity">
            <label className="ad-filter">
              Person
              <select className="ad-select" value={actor} onChange={(e) => setActor(e.target.value)}>
                <option value="">Everyone</option>
                {(staff.data ?? []).map((m) => (
                  <option key={m.id} value={m.user_email}>{m.user_email}</option>
                ))}
              </select>
            </label>
            <label className="ad-filter">
              Type
              <select className="ad-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All activity</option>
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="ad-filter">
              From
              <input className="ad-input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="ad-filter">
              To
              <input className="ad-input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            {filtersActive && (
              <button type="button" className="ad-link" onClick={() => { setActor(''); setCategory(''); setFrom(''); setTo(''); }}>Clear filters</button>
            )}
          </div>
          {badRange && <p className="field-error" role="alert">The start date is after the end date.</p>}

          {q.isPending ? (
            <div aria-busy="true" aria-label="Loading activity">
              <div className="ad-skel" style={{ height: 70, borderRadius: 14, marginBottom: 10 }} />
              <div className="ad-skel" style={{ height: 70, borderRadius: 14, marginBottom: 10 }} />
              <div className="ad-skel" style={{ height: 70, borderRadius: 14 }} />
            </div>
          ) : q.isError ? (
            <div className="card ad-empty" role="alert">
              <div className="ad-empty-icon" aria-hidden="true">⚠️</div>
              <strong>We couldn&apos;t load the activity</strong>
              <span>{parseError(q.error).display}</span>
              <Button onClick={() => q.refetch()}>Try again</Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="card ad-empty">
              <div className="ad-empty-icon" aria-hidden="true">🕘</div>
              <strong>{filtersActive ? 'No activity matches these filters' : 'Nothing has happened yet'}</strong>
              <span>{filtersActive ? 'Try a wider date range or clear the filters.' : 'Changes your team makes will appear here.'}</span>
            </div>
          ) : (
            <>
              {days.map((d) => (
                <Fragment key={d.label}>
                  <h2 className="st-day">{d.label}</h2>
                  <div className="card">
                    <ul className="st-feed">
                      {d.rows.map((e) => (
                        <li key={e.id}>
                          <span className="st-feed-icon" aria-hidden="true">{categoryIcon(e.action)}</span>
                          <div className="st-feed-main">
                            <div className="st-feed-text">{e.description}</div>
                            <div className="st-feed-sub">
                              {e.actor_name?.trim() || e.actor_email}
                              {e.actor_role ? ` · ${roleLabel(e.actor_role)}` : ''}
                              {e.ip_address ? ` · ${e.ip_address}` : ''}
                            </div>
                          </div>
                          <time className="st-feed-time" dateTime={e.created_at}>
                            {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </time>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Fragment>
              ))}
              <div className="ad-actions" style={{ justifyContent: 'center', marginTop: 8 }}>
                {q.hasNextPage ? (
                  <Button variant="ghost" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage} loadingText="Loading…">Load older activity</Button>
                ) : (
                  <span className="ad-muted">That&apos;s everything.</span>
                )}
              </div>
            </>
          )}
        </>
      )}
    </StaffFrame>
  );
}
