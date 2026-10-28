import type { Metadata } from 'next';
import { MenuItemEditorView } from '@/components/admin/menu-item-editor-view';

export const metadata: Metadata = { title: 'Add a dish' };

export default function OwnerNewMenuItemPage() {
  return <MenuItemEditorView id={null} />;
}
