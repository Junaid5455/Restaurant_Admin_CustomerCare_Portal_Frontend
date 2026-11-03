import type { Metadata } from 'next';
import { OrderStatusView } from '@/components/customer/order-status-view';

export const metadata: Metadata = { title: 'Order status' };

export default function OrderStatusPage() {
  return <OrderStatusView />;
}
