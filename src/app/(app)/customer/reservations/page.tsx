import type { Metadata } from 'next';
import { MyReservationsView } from '@/components/customer/my-reservations-view';

export const metadata: Metadata = { title: 'Reservations' };

export default function ReservationsPage() {
  return <MyReservationsView />;
}
