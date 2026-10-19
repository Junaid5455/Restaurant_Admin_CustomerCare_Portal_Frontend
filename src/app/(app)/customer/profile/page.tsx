import type { Metadata } from 'next';
import { ProfileView } from '@/components/customer/profile-view';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return <ProfileView />;
}
