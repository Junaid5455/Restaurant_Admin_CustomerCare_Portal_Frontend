'use client';

import './reviews.css';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Kpi } from './analytics-kit';
import { Pager } from './orders-kit';
import { Chips, LoadError, PageHead, TableSkeleton } from './super-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Button } from '@/components/ui/submit-button';
import { Stars } from '@/components/ui/stars';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { OWNER_REVIEWS_KEY, useOwnerReviews } from '@/hooks/use-reviews';
import { REPLY_MAX, reviewsApi, type Review, type ReviewPage } from '@/lib/api/reviews';
import { parseError } from '@/lib/errors';
import { formatAverage, hasReply, matches, sortForOwner, summarize, type ReplyFilter } from '@/lib/reviews';
import { timeAgo } from '@/lib/time-ago';

const PAGE = 10;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ReviewCard({ r, onSaved }: { r: Review; onSaved: (r: Review) => void }) {
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.owner_reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const replied = hasReply(r);

  async function save(next: string, doneMessage: string) {
    setBusy(true); setError(null);
    try {
      const saved = await reviewsApi.reply(r.id, next);
      onSaved(saved);
      setEditing(false);
      setRemoving(false);
      push(doneMessage);
    } catch (e) {
      const msg = parseError(e);
      if (removing) { push(msg.display, 'error'); } else { setError(msg.fieldErrors.reply || msg.display); }
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = text.trim();
    if (!next) { setError('Write a reply first.'); return; }
    void save(next, replied ? 'Reply updated' : 'Reply sent');
  }

  return (
    <li className={`card rw-card ${replied ? '' : 'waiting'}`} aria-label={`${r.rating} star review by ${r.customer_name}`}>
      <div className="rw-head">
        <div className="rw-who">
          <Stars value={r.rating} size={18} />
          <strong>{r.customer_name}</strong>
          <span className="rw-sub">
            {fmt(r.created_at)} · {timeAgo(r.created_at)}
            {r.order_number && <> · Order <Link className="an-link" href={`/owner/orders/${r.order}`}>#{r.order_number}</Link></>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!r.is_visible && <span className="badge badge-crit">Hidden by the platform team</span>}
          {!replied && <span className="badge badge-warn">Needs a reply</span>}
        </div>
      </div>

      <p className={`rw-comment ${r.comment.trim() ? '' : 'none'}`}>{r.comment.trim() || 'No comment, just a rating.'}</p>

      {replied && !editing && (
        <div className="rw-reply">
          <div className="rw-reply-h"><strong>Your reply</strong>{r.replied_at && <span>{timeAgo(r.replied_at)}</span>}</div>
          <p>{r.owner_reply}</p>
        </div>
      )}

      {editing ? (
        <form className="rw-form" onSubmit={submit} noValidate>
          <TextArea label={replied ? 'Edit your reply' : 'Reply to this guest'} rows={3} value={text} maxLength={REPLY_MAX} counter
            placeholder="Thank them, or say how you’ll put it right. Replies are public." onChange={(e) => { setText(e.target.value); setError(null); }} error={error ?? undefined} />
          <div className="rw-actions">
            <Button type="submit" loading={busy} loadingText="Sending…">{replied ? 'Save reply' : 'Send reply'}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setText(r.owner_reply); setError(null); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="rw-actions">
          {replied ? (
            <>
              <button type="button" className="ad-link" onClick={() => { setText(r.owner_reply); setEditing(true); }} aria-label={`Edit your reply to ${r.customer_name}`}>Edit reply</button>
              <button type="button" className="ad-link danger" onClick={() => setRemoving(true)} aria-label={`Remove your reply to ${r.customer_name}`}>Remove reply</button>
            </>
          ) : (
            <Button variant="ghost" className="ad-btn-sm" onClick={() => setEditing(true)} aria-label={`Reply to ${r.customer_name}`}>Reply</Button>
          )}
        </div>
      )}

      {removing && (
        <ConfirmDialog title="Remove your reply?" message="The guest and everyone else will no longer see it. You can write a new one any time." confirmLabel="Remove reply" busy={busy}
          onConfirm={() => void save('', 'Reply removed')} onClose={() => !busy && setRemoving(false)} />
      )}
    </li>
  );
}

export function OwnerReviewsView() {
  const q = useOwnerReviews();
  const qc = useQueryClient();
  const [reply, setReply] = useState<ReplyFilter>('waiting');
  const [rating, setRating] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const all = useMemo(() => q.data?.reviews ?? [], [q.data]);
  const sum = useMemo(() => summarize(all), [all]);
  const shown = useMemo(() => all.filter((r) => matches(r, reply, rating, search)).sort(sortForOwner), [all, reply, rating, search]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages);
  const view = shown.slice((at - 1) * PAGE, at * PAGE);
  const max = Math.max(1, ...Object.values(sum.distribution));
  const count = (f: ReplyFilter) => all.filter((r) => matches(r, f, null, '')).length;
  const reset = () => { setReply('all'); setRating(null); setSearch(''); setPage(1); };

  const onSaved = (saved: Review) =>
    qc.setQueryData<ReviewPage>(OWNER_REVIEWS_KEY, (cur) => (cur ? { ...cur, reviews: cur.reviews.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)) } : cur));

  return (
    <>
      <PageHead title="Reviews" description="What guests say about your food and service. Replies are public, so answer kindly." />
      <div className="ad-stack">
        <div className="rw-top">
          <section className="card ad-card-pad rw-big" aria-label="Average rating">
            {q.isPending ? <div className="ad-skel" style={{ height: 120 }} aria-busy="true" aria-label="Loading" /> : (
              <>
                <div className="rw-avg">{formatAverage(sum.average)}<small> / 5</small></div>
                <Stars value={sum.average} size={22} />
                <span className="rw-sub">{sum.total === 0 ? 'No reviews yet' : `${sum.total} ${sum.total === 1 ? 'review' : 'reviews'}`}</span>
              </>
            )}
          </section>
          <section className="card ad-card-pad" aria-label="Rating breakdown">
            <h2 className="ad-card-title">Breakdown</h2>
            <div className="rw-bars">
              {[5, 4, 3, 2, 1].map((n) => (
                <button key={n} type="button" className="rw-bar" aria-pressed={rating === n} aria-label={`${n} star reviews: ${sum.distribution[String(n)] ?? 0}. Click to ${rating === n ? 'clear this filter' : 'show only these'}`} onClick={() => { setRating(rating === n ? null : n); setPage(1); }}>
                  <span>{n} ★</span>
                  <span className="rw-track"><span className="rw-fill" style={{ width: `${((sum.distribution[String(n)] ?? 0) / max) * 100}%` }} /></span>
                  <span className="rw-n">{sum.distribution[String(n)] ?? 0}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="ad-kpis">
          <Kpi tone="coral" icon="💬" label="Need a reply" value={q.data ? String(sum.awaiting_reply) : null} sub={sum.awaiting_reply ? 'Guests are waiting to hear from you' : 'You’re all caught up'} loading={q.isPending} />
          <Kpi tone="teal" icon="✅" label="Replied" value={q.data ? String(sum.replied) : null} sub={sum.total ? `${Math.round((sum.replied / sum.total) * 100)}% of reviews` : 'Nothing to answer yet'} loading={q.isPending} />
          <Kpi tone="yellow" icon="😕" label="Low ratings" value={q.data ? String((sum.distribution['1'] ?? 0) + (sum.distribution['2'] ?? 0)) : null} sub="1 or 2 stars" loading={q.isPending} />
        </div>

        {q.isError ? <LoadError query={q} what="reviews" /> : q.isPending ? <TableSkeleton rows={4} /> : (
          <>
            <div className="su-toolbar">
              <Chips label="Show" value={reply} onChange={(v) => { setReply(v); setPage(1); }} options={[
                { id: 'waiting', label: 'Needs reply', count: count('waiting') },
                { id: 'replied', label: 'Replied', count: count('replied') },
                { id: 'all', label: 'All', count: all.length },
              ]} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {rating !== null && <Button variant="ghost" className="ad-btn-sm" onClick={() => setRating(null)}>{rating} ★ only ✕</Button>}
                <input className="ad-input su-search" type="search" aria-label="Search reviews" placeholder="Comment, guest or order number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="card ad-empty">
                <div className="ad-empty-icon" aria-hidden="true">{all.length === 0 ? '⭐' : reply === 'waiting' && !search && rating === null ? '🎉' : '🔍'}</div>
                {all.length === 0 ? (
                  <><strong>No reviews yet</strong><span>After a guest’s order is delivered, they can rate it. Their reviews will show up here.</span></>
                ) : reply === 'waiting' && !search && rating === null ? (
                  <><strong>Every review has your reply</strong><span>Nicely done. New reviews will appear here.</span><Button variant="ghost" onClick={() => setReply('all')}>See all reviews</Button></>
                ) : (
                  <><strong>Nothing here</strong><span>No reviews match these filters.</span><Button variant="ghost" onClick={reset}>Show all reviews</Button></>
                )}
              </div>
            ) : (
              <ul className="rw-list">{view.map((r) => <ReviewCard key={r.id} r={r} onSaved={onSaved} />)}</ul>
            )}
            <Pager page={at} totalPages={pages} totalItems={shown.length} noun="reviews" onPage={setPage} />
            {q.data && q.data.total > all.length && <p className="an-note">Showing your latest {all.length} of {q.data.total} reviews.</p>}
          </>
        )}
      </div>
    </>
  );
}
