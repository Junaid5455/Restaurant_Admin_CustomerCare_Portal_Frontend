import { SuperTicketView } from '@/components/admin/super-ticket-view';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SuperTicketView id={id} />;
}
