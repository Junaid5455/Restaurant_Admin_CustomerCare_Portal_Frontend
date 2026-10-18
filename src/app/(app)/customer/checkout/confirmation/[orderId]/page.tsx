import type { Metadata } from 'next';
import { ConfirmationView } from '@/components/customer/confirmation-view';

export const metadata: Metadata = { title: 'Order confirmation' };

export default async function ConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ConfirmationView orderId={orderId} />;
}
