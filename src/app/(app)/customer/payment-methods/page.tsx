import type { Metadata } from 'next';
import { PaymentMethodsView } from '@/components/customer/payment-methods-view';

export const metadata: Metadata = { title: 'Payment methods' };

export default function PaymentMethodsPage() {
  return <PaymentMethodsView />;
}
