import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';

/* ───────────── Types (match the reviews app serializers) ───────────── */

export interface Review {
  id: string;
  restaurant: string;
  restaurant_name?: string;
  /** "Sara K." Reviews are public, so the API never sends an email address. */
  customer_name: string;
  order: string;
  order_number?: string;
  /** 1 to 5. */
  rating: number;
  comment: string;
  owner_reply: string;
  replied_at: string | null;
  /** False when the platform team hid it. Only owners and the author see hidden reviews. */
  is_visible: boolean;
  created_at: string;
}

export interface ReviewSummary {
  average: number;
  total: number;
  /** "1" to "5" → how many reviews gave that rating. */
  distribution: Record<string, number>;
  replied: number;
  awaiting_reply: number;
}

/** A delivered order the guest hasn't reviewed yet. */
export interface EligibleOrder {
  id: string;
  order_number: string;
  restaurant: string;
  restaurant_name: string;
  created_at: string;
}

export interface ReviewInput {
  order: string;
  rating: number;
  comment?: string;
}

export interface ReviewPage {
  reviews: Review[];
  total: number;
}

export const COMMENT_MAX = 1000;
export const REPLY_MAX = 1000;

const PAGE = 100;
const MAX_PAGES = 5;

interface Body {
  data?: Review[];
  results?: Review[];
  count?: number;
  next?: string | null;
  meta?: { has_next?: boolean; total_items?: number };
}

export const reviewsApi = {
  /** Up to 500 reviews, newest first. Reads the raw body so the real total survives. */
  async list(params: { restaurant?: string } = {}): Promise<ReviewPage> {
    try {
      let all: Review[] = [];
      let total = 0;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await api.get('/reviews/', { params: { ...params, page, page_size: PAGE } });
        const body = res.data as Body | Review[];
        if (Array.isArray(body)) return { reviews: body, total: body.length };
        all = all.concat(body.data ?? body.results ?? []);
        total = body.meta?.total_items ?? body.count ?? all.length;
        const more = body.meta ? !!body.meta.has_next : !!body.next;
        if (!more) break;
      }
      return { reviews: all, total };
    } catch (e) {
      throw parseError(e);
    }
  },

  summary: (restaurant?: string) => call<ReviewSummary>(() => api.get('/reviews/summary/', { params: restaurant ? { restaurant } : {} })),

  eligible: () => call<EligibleOrder[]>(() => api.get('/reviews/eligible/')),

  create: (input: ReviewInput) => call<Review>(() => api.post('/reviews/', input)),

  update: (id: string, patch: { rating?: number; comment?: string }) => call<Review>(() => api.patch(`/reviews/${id}/`, patch)),

  async remove(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/reviews/${id}/`));
  },

  /** An empty reply removes the restaurant's answer. */
  reply: (id: string, reply: string) => call<Review>(() => api.post(`/reviews/${id}/reply/`, { reply })),
};
