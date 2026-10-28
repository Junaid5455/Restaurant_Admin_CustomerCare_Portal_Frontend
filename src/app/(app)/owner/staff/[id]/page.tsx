import { StaffEditorView } from '@/components/admin/staff-editor-view';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffEditorView id={id} />;
}
