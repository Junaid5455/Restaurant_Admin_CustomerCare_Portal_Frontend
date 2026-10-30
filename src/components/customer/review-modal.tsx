'use client';

import './reviews.css';
import { useId, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { StarInput } from '@/components/ui/stars';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { ELIGIBLE_KEY, MY_REVIEWS_KEY } from '@/hooks/use-reviews';
import { COMMENT_MAX, reviewsApi, type EligibleOrder, type Review } from '@/lib/api/reviews';
import { parseError } from '@/lib/errors';
import { RATING_WORD } from '@/lib/reviews';

/** Write a review for a delivered order, or edit one you already wrote. */
export function ReviewModal({ order, review, onClose }: { order?: EligibleOrder; review?: Review; onClose: () => void }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const titleId = useId();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const place = review?.restaurant_name ?? order?.restaurant_name ?? 'the restaurant';
  const number = review?.order_number ?? order?.order_number;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rating) { setRatingError('Tap a star to rate your order.'); return; }
    setBusy(true);
    try {
      if (review) await reviewsApi.update(review.id, { rating, comment: comment.trim() });
      else await reviewsApi.create({ order: order!.id, rating, comment: comment.trim() });
      await Promise.all([qc.invalidateQueries({ queryKey: MY_REVIEWS_KEY }), qc.invalidateQueries({ queryKey: ELIGIBLE_KEY }), qc.invalidateQueries({ queryKey: ['restaurant-reviews'] }), qc.invalidateQueries({ queryKey: ['review-summary'] })]);
      push(review ? 'Review updated' : 'Thanks for your review!');
      onClose();
    } catch (err) {
      const pe = parseError(err);
      setError(pe.fieldErrors.order || pe.fieldErrors.rating || pe.fieldErrors.comment || pe.fieldErrors.detail || pe.display);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} labelledBy={titleId}>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body">
            <h2 id={titleId} className="sv-modal-title">{review ? 'Edit your review' : `How was ${place}?`}</h2>
            {review && <p className="mr-sub" style={{ margin: 0 }}>{place}{number ? ` · Order #${number}` : ''}</p>}
            {!review && number && <p className="mr-sub" style={{ margin: 0 }}>Order #{number}</p>}
            {error && <Alert>{error}</Alert>}
            <div className="mr-rate">
              <StarInput value={rating} onChange={(n) => { setRating(n); setRatingError(null); }} label="Your rating" />
              <div className="mr-word" aria-live="polite">{rating ? RATING_WORD[rating] : ''}</div>
              {ratingError && <p className="field-error" role="alert">{ratingError}</p>}
            </div>
            <TextArea label="Tell others more (optional)" rows={4} value={comment} maxLength={COMMENT_MAX} counter placeholder="What did you love? What could be better?" onChange={(e) => setComment(e.target.value)} />
            <p className="field-hint">Your first name and last initial are shown with your review. The restaurant can reply publicly.</p>
          </div>
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <Button type="submit" loading={busy} loadingText="Saving…">{review ? 'Save changes' : 'Post review'}</Button>
        </div>
      </form>
    </Modal>
  );
}
