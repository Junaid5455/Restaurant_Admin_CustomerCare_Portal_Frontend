import type { Review, ReviewSummary } from './api/reviews';

export const hasReply = (r: Pick<Review, 'owner_reply'>) => r.owner_reply.trim().length > 0;

/** Builds the same summary the API gives, from a list already in memory (owners load every review anyway). */
export function summarize(reviews: Review[]): ReviewSummary {
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let sum = 0;
  for (const r of reviews) {
    distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1;
    sum += r.rating;
  }
  const replied = reviews.filter(hasReply).length;
  return {
    average: reviews.length ? Math.round((sum / reviews.length) * 100) / 100 : 0,
    total: reviews.length,
    distribution,
    replied,
    awaiting_reply: reviews.length - replied,
  };
}

export type ReplyFilter = 'all' | 'waiting' | 'replied';

export function matches(r: Review, reply: ReplyFilter, rating: number | null, search: string): boolean {
  if (reply === 'waiting' && hasReply(r)) return false;
  if (reply === 'replied' && !hasReply(r)) return false;
  if (rating !== null && r.rating !== rating) return false;
  const s = search.trim().toLowerCase();
  return !s || [r.comment, r.customer_name, r.order_number, r.owner_reply].some((v) => v?.toLowerCase().includes(s));
}

export const RATING_WORD: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

export const formatAverage = (n: number) => (n ? n.toFixed(1) : '–');

/** Waiting reviews first (oldest first, so nobody is left hanging), then the rest newest first. */
export function sortForOwner(a: Review, b: Review): number {
  const wa = !hasReply(a);
  const wb = !hasReply(b);
  if (wa !== wb) return wa ? -1 : 1;
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  return wa ? ta - tb : tb - ta;
}
