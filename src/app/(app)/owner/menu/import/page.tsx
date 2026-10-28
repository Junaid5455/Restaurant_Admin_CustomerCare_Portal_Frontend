import type { Metadata } from 'next';
import { MenuImportView } from '@/components/admin/menu-import-view';

export const metadata: Metadata = { title: 'Import & export menu' };

export default function OwnerMenuImportPage() {
  return <MenuImportView />;
}
