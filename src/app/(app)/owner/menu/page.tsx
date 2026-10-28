import type { Metadata } from 'next';
import { MenuItemsView } from '@/components/admin/menu-items-view';

export const metadata: Metadata = { title: 'Menu' };

export default function OwnerMenuPage() {
  return <MenuItemsView />;
}
