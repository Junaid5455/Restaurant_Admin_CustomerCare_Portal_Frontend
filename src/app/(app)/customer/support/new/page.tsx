import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SupportNewView } from '@/components/customer/support-new-view';

export const metadata: Metadata = { title: 'New support ticket' };

export default function NewSupportTicketPage() {
  return (
    <Suspense fallback={null}>
      <SupportNewView />
    </Suspense>
  );
}
