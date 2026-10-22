import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrdersView } from '@/components/admin/orders-view';

export const metadata: Metadata = { title: 'Orders' };

export default function OwnerOrdersPage() {
  // OrdersView reads the URL (?status, ?type, ?pay, ?page), which requires a Suspense boundary.
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}
