import type { Metadata } from 'next';
import { MenuCategoriesView } from '@/components/admin/menu-categories-view';

export const metadata: Metadata = { title: 'Menu categories' };

export default function OwnerMenuCategoriesPage() {
  return <MenuCategoriesView />;
}
