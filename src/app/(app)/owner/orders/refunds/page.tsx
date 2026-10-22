import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RefundsView } from '@/components/admin/refunds-view';

export const metadata: Metadata = { title: 'Refunds' };

export default function OwnerRefundsPage() {
  return (
    <Suspense>
      <RefundsView />
    </Suspense>
  );
}
