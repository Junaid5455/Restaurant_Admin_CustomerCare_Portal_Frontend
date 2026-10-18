import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RestaurantsBrowser } from '@/components/customer/restaurants-browser';

export const metadata: Metadata = { title: 'Restaurants' };

export default function RestaurantsPage() {
  // RestaurantsBrowser reads the URL (?q, filters, page), which requires a Suspense boundary.
  return (
    <Suspense>
      <RestaurantsBrowser />
    </Suspense>
  );
}
