import { OwnerTicketView } from '@/components/admin/owner-ticket-view';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerTicketView id={id} />;
}
