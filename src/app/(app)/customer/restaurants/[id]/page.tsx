import { RestaurantDetail } from '@/components/customer/restaurant-detail';

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RestaurantDetail id={id} />;
}
