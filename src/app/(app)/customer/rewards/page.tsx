import type { Metadata } from 'next';
import { RewardsView } from '@/components/customer/rewards-view';

export const metadata: Metadata = { title: 'Loyalty & rewards' };

export default function RewardsPage() {
  return <RewardsView />;
}
