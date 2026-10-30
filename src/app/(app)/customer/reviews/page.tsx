import type { Metadata } from 'next';
import { MyReviewsView } from '@/components/customer/my-reviews-view';

export const metadata: Metadata = { title: 'Reviews' };

export default function ReviewsPage() {
  return <MyReviewsView />;
}
