import type { Metadata } from 'next';
import { OrderDetailView } from '@/components/admin/order-detail-view';

export const metadata: Metadata = { title: 'Order' };

export default async function OwnerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView id={id} />;
}
