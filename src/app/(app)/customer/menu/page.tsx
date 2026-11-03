import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MenuView } from '@/components/customer/menu-view';

export const metadata: Metadata = { title: 'Menu' };

export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuView />
    </Suspense>
  );
}
