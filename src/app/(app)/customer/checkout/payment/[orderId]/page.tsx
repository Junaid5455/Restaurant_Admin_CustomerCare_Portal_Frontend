import type { Metadata } from 'next';
import { PaymentView } from '@/components/customer/payment-view';

export const metadata: Metadata = { title: 'Payment' };

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <PaymentView orderId={orderId} />;
}
