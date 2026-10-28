import type { Metadata } from 'next';
import { MenuItemEditorView } from '@/components/admin/menu-item-editor-view';

export const metadata: Metadata = { title: 'Edit dish' };

export default async function OwnerMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MenuItemEditorView id={id} />;
}
