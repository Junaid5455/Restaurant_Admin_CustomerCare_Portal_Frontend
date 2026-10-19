import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FavoritesView } from '@/components/customer/favorites-view';

export const metadata: Metadata = { title: 'Favorites' };

export default function FavoritesPage() {
  return (
    <Suspense fallback={null}>
      <FavoritesView />
    </Suspense>
  );
}
