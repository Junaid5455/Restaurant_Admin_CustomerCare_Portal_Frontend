'use client';

import './reviews.css';
import { useState } from 'react';
import { Button } from '@/components/ui/submit-button';
import { Stars } from '@/components/ui/stars';
import { useRestaurantReviews, useReviewSummary } from '@/hooks/use-reviews';
import { hasReply } from '@/lib/reviews';
import { formatAverage } from '@/lib/reviews';
import { timeAgo } from '@/lib/time-ago';

const SHOW = 5;

/** What other guests said about this restaurant. Hidden entirely until there is at least one review. */
export function RestaurantReviews({ restaurantId, name }: { restaurantId: string; name: string }) {
  const list = useRestaurantReviews(restaurantId);
  const sum = useReviewSummary(restaurantId);
  const [all, setAll] = useState(false);
  const reviews = list.data?.reviews ?? [];

  if (list.isPending) return <div className="sv-skel" aria-busy="true" aria-label="Loading reviews" style={{ height: 120, borderRadius: 16 }} />;
  if (list.isError || reviews.length === 0) return null;
  const shown = all ? reviews : reviews.slice(0, SHOW);
  const s = sum.data;
  const max = s ? Math.max(1, ...Object.values(s.distribution)) : 1;

  return (
    <section className="mr-section" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" style={{ fontSize: 22, fontWeight: 800 }}>Reviews</h2>
      {s && s.total > 0 && (
        <div className="card mr-summary">
          <div className="mr-avg"><b>{formatAverage(s.average)}</b><Stars value={s.average} size={16} /><div className="mr-sub">{s.total} {s.total === 1 ? 'review' : 'reviews'}</div></div>
          <div className="mr-bars" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="mr-bar"><span>{n} ★</span><span className="t"><i style={{ width: `${((s.distribution[String(n)] ?? 0) / max) * 100}%` }} /></span><span className="n">{s.distribution[String(n)] ?? 0}</span></div>
            ))}
          </div>
        </div>
      )}
      <div className="mr-list">
        {shown.map((r) => (
          <article key={r.id} className="card mr-card" aria-label={`${r.rating} star review by ${r.customer_name}`}>
            <div className="mr-head">
              <div><Stars value={r.rating} size={16} /><div className="mr-sub"><strong>{r.customer_name}</strong> · {timeAgo(r.created_at)}</div></div>
            </div>
            {r.comment.trim() && <p className="mr-comment">{r.comment}</p>}
            {hasReply(r) && <div className="mr-reply"><strong>Reply from {name}</strong><p>{r.owner_reply}</p></div>}
          </article>
        ))}
      </div>
      {reviews.length > SHOW && <div><Button variant="ghost" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${reviews.length} reviews`}</Button></div>}
    </section>
  );
}
