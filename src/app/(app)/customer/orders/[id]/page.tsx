import type { Metadata } from 'next';
import { OrderDetailView } from '@/components/customer/order-detail-view';

export const metadata: Metadata = { title: 'Order details' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView orderId={id} />;
}
