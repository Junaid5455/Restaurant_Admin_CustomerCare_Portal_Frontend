import type { Metadata } from 'next';
import { SupportTicketView } from '@/components/customer/support-ticket-view';

export const metadata: Metadata = { title: 'Support ticket' };

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupportTicketView ticketId={id} />;
}
