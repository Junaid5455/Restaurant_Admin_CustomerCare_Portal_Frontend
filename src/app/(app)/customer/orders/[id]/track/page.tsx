import type { Metadata } from 'next';
import { OrderTrackView } from '@/components/customer/order-track-view';

export const metadata: Metadata = { title: 'Track order' };

export default async function OrderTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderTrackView orderId={id} />;
}
