import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrdersBrowser } from '@/components/customer/orders-browser';

export const metadata: Metadata = { title: 'My orders' };

export default function OrdersPage() {
  // OrdersBrowser reads the URL (?status, ?type, ?page), which requires a Suspense boundary.
  return (
    <Suspense>
      <OrdersBrowser />
    </Suspense>
  );
}
