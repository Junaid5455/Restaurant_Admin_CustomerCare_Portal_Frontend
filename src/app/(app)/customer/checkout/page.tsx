import type { Metadata } from 'next';
import { CheckoutView } from '@/components/customer/checkout-view';

export const metadata: Metadata = { title: 'Checkout' };

export default function CheckoutPage() {
  return <CheckoutView />;
}
