import type { Metadata } from 'next';
import { SupportListView } from '@/components/customer/support-list-view';

export const metadata: Metadata = { title: 'Support' };

export default function SupportPage() {
  return <SupportListView />;
}
