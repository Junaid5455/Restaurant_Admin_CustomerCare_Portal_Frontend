import { DeliveryDetailView } from '@/components/admin/delivery-detail-view';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryDetailView id={id} />;
}
