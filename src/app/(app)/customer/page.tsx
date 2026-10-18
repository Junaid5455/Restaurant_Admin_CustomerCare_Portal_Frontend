import { redirect } from 'next/navigation';

// The customer home is restaurant discovery.
export default function CustomerHome() {
  redirect('/customer/restaurants');
}
