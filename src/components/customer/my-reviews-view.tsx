'use client';

import './reviews.css';
import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { ReviewModal } from './review-modal';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { Stars } from '@/components/ui/stars';
import { useToast } from '@/components/ui/toast';
import { ELIGIBLE_KEY, MY_REVIEWS_KEY, useEligibleOrders, useMyReviews } from '@/hooks/use-reviews';
import { reviewsApi, type EligibleOrder, type Review } from '@/lib/api/reviews';
import { parseError } from '@/lib/errors';
import { hasReply } from '@/lib/reviews';
import { timeAgo } from '@/lib/time-ago';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function MyReviewsView() {
  const mine = useMyReviews();
  const todo = useEligibleOrders();
  const qc = useQueryClient();
  const { push } = useToast();
  const [writing, setWriting] = useState<EligibleOrder | null>(null);
  const [editing, setEditing] = useState<Review | null>(null);
  const [removing, setRemoving] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await reviewsApi.remove(removing.id);
      await Promise.all([qc.invalidateQueries({ queryKey: MY_REVIEWS_KEY }), qc.invalidateQueries({ queryKey: ELIGIBLE_KEY }), qc.invalidateQueries({ queryKey: ['restaurant-reviews'] }), qc.invalidateQueries({ queryKey: ['review-summary'] })]);
      push('Review deleted');
      setRemoving(null);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setBusy(false);
    }
  }

  const reviews = mine.data?.reviews ?? [];
  const orders = todo.data ?? [];

  return (
    <>
      <div className="sv-page-head">
        <h1>Reviews</h1>
        <p>Rate the orders you’ve received. Your feedback helps other guests and the restaurant.</p>
      </div>

      <section className="mr-section" aria-labelledby="mr-todo-h">
        <h2 id="mr-todo-h">Waiting for your review{todo.data && orders.length > 0 ? ` (${orders.length})` : ''}</h2>
        {todo.isPending ? (
          <div className="mr-list" aria-busy="true" aria-label="Loading orders">{[0, 1].map((i) => <div key={i} className="sv-skel" style={{ height: 66, borderRadius: 16 }} />)}</div>
        ) : todo.isError ? (
          <div className="sv-acct-inline"><Alert>{parseError(todo.error).display}</Alert><Button variant="ghost" onClick={() => void todo.refetch()}>Try again</Button></div>
        ) : orders.length === 0 ? (
          <div className="card mr-todo"><div><strong>You’re all caught up</strong><span>Delivered orders you haven’t rated will show up here.</span></div><Link href="/customer/restaurants" className="btn btn-ghost">Order something</Link></div>
        ) : (
          <div className="mr-list">
            {orders.map((o) => (
              <div key={o.id} className="card mr-todo">
                <div><strong>{o.restaurant_name}</strong><span>Order #{o.order_number} · {date(o.created_at)}</span></div>
                <Button onClick={() => setWriting(o)} aria-label={`Write a review for order ${o.order_number} from ${o.restaurant_name}`}>Write a review</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mr-section" aria-labelledby="mr-mine-h">
        <h2 id="mr-mine-h">Your reviews{mine.data && reviews.length > 0 ? ` (${reviews.length})` : ''}</h2>
        {mine.isPending ? (
          <div className="mr-list" aria-busy="true" aria-label="Loading your reviews">{[0, 1].map((i) => <div key={i} className="sv-skel" style={{ height: 120, borderRadius: 16 }} />)}</div>
        ) : mine.isError ? (
          <div className="sv-acct-inline"><Alert>{parseError(mine.error).display}</Alert><Button variant="ghost" onClick={() => void mine.refetch()}>Try again</Button></div>
        ) : reviews.length === 0 ? (
          <div className="sv-state" style={{ paddingTop: 30, paddingBottom: 30 }}>
            <div className="emoji" aria-hidden="true">⭐</div>
            <h2>No reviews yet</h2>
            <p>Once an order is delivered you can rate it here.</p>
          </div>
        ) : (
          <div className="mr-list">
            {reviews.map((r) => (
              <article key={r.id} className="card mr-card" aria-label={`Your ${r.rating} star review of ${r.restaurant_name}`}>
                <div className="mr-head">
                  <div>
                    <h3><Link href={`/customer/restaurants/${r.restaurant}`} className="mr-place">{r.restaurant_name}</Link></h3>
                    <span className="mr-sub">Order #{r.order_number} · {date(r.created_at)} · {timeAgo(r.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!r.is_visible && <span className="badge badge-crit">Hidden</span>}
                    <Stars value={r.rating} size={18} />
                  </div>
                </div>
                <p className={`mr-comment ${r.comment.trim() ? '' : 'none'}`}>{r.comment.trim() || 'No comment.'}</p>
                {hasReply(r) && <div className="mr-reply"><strong>Reply from {r.restaurant_name}</strong><p>{r.owner_reply}</p></div>}
                <div className="mr-actions">
                  {hasReply(r) ? <span className="mr-sub">The restaurant has replied, so this review is locked.</span> : <button type="button" className="sv-link-btn" onClick={() => setEditing(r)} aria-label={`Edit your review of ${r.restaurant_name}`}>Edit</button>}
                  <button type="button" className="sv-link-btn" onClick={() => setRemoving(r)} aria-label={`Delete your review of ${r.restaurant_name}`}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {writing && <ReviewModal key={writing.id} order={writing} onClose={() => setWriting(null)} />}
      {editing && <ReviewModal key={editing.id} review={editing} onClose={() => setEditing(null)} />}
      {removing && <ConfirmDialog title="Delete this review?" message={`Your review of ${removing.restaurant_name} will be removed. You can review the order again afterwards.`} confirmLabel="Delete review" busy={busy} onConfirm={() => void remove()} onClose={() => !busy && setRemoving(null)} />}
    </>
  );
}
