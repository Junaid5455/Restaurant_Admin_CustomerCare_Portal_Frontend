import { useQuery } from '@tanstack/react-query';
import { reviewsApi } from '@/lib/api/reviews';

export const OWNER_REVIEWS_KEY = ['owner-reviews'] as const;
export const MY_REVIEWS_KEY = ['my-reviews'] as const;
export const ELIGIBLE_KEY = ['eligible-reviews'] as const;
export const restaurantReviewsKey = (id: string) => ['restaurant-reviews', id] as const;
export const reviewSummaryKey = (id: string) => ['review-summary', id] as const;

/** Every review of the owner's restaurant(s). */
export const useOwnerReviews = () =>
  useQuery({ queryKey: OWNER_REVIEWS_KEY, queryFn: () => reviewsApi.list(), retry: false, staleTime: 30_000, refetchOnWindowFocus: true, refetchInterval: 60_000 });

/** The guest's own reviews. */
export const useMyReviews = () => useQuery({ queryKey: MY_REVIEWS_KEY, queryFn: () => reviewsApi.list(), retry: false, staleTime: 30_000, refetchOnWindowFocus: true });

/** Delivered orders the guest hasn't reviewed yet. */
export const useEligibleOrders = () => useQuery({ queryKey: ELIGIBLE_KEY, queryFn: reviewsApi.eligible, retry: false, staleTime: 30_000, refetchOnWindowFocus: true });

/** Public reviews of one restaurant (visible ones only). */
export const useRestaurantReviews = (restaurantId: string) =>
  useQuery({ queryKey: restaurantReviewsKey(restaurantId), queryFn: () => reviewsApi.list({ restaurant: restaurantId }), retry: false, staleTime: 60_000 });

export const useReviewSummary = (restaurantId: string) =>
  useQuery({ queryKey: reviewSummaryKey(restaurantId), queryFn: () => reviewsApi.summary(restaurantId), retry: false, staleTime: 60_000 });
