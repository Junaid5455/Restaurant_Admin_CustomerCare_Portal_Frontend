import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';

/* ───────────── Types (verified against apps/support serializers, models and views) ───────────── */

export type TicketCategory =
  | 'ORDER_ISSUE'
  | 'DELIVERY_ISSUE'
  | 'PAYMENT_ISSUE'
  | 'MISSING_ITEMS'
  | 'INCORRECT_ITEMS'
  | 'QUALITY_ISSUE'
  | 'REFUND_REQUEST'
  | 'GENERAL_INQUIRY'
  | 'OTHER';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'WAITING_FOR_RESTAURANT'
  | 'RESOLVED'
  | 'CLOSED';

export interface TicketMessage {
  id: string;
  ticket: string;
  sender: string;
  /** The sender's email. For staff messages the UI shows "Support team" instead. */
  sender_email: string;
  message: string;
  message_type: 'CUSTOMER_MESSAGE' | 'STAFF_MESSAGE';
  attachment: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_id: string;
  customer: string;
  customer_email: string;
  restaurant: string | null;
  related_order: string | null;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: string;
  status: TicketStatus;
  is_resolved: boolean;
  created_at: string;
  messages: TicketMessage[];
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  category: TicketCategory;
  related_order?: string;
  restaurant?: string;
}

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  ORDER_ISSUE: 'Order issue',
  DELIVERY_ISSUE: 'Delivery issue',
  PAYMENT_ISSUE: 'Payment issue',
  MISSING_ITEMS: 'Missing items',
  INCORRECT_ITEMS: 'Incorrect items',
  QUALITY_ISSUE: 'Quality issue',
  REFUND_REQUEST: 'Refund request',
  GENERAL_INQUIRY: 'General inquiry',
  OTHER: 'Other',
};

export const CATEGORY_ICON: Record<TicketCategory, string> = {
  ORDER_ISSUE: '🧾',
  DELIVERY_ISSUE: '🛵',
  PAYMENT_ISSUE: '💳',
  MISSING_ITEMS: '📦',
  INCORRECT_ITEMS: '🔁',
  QUALITY_ISSUE: '👎',
  REFUND_REQUEST: '💸',
  GENERAL_INQUIRY: '💬',
  OTHER: '❓',
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as TicketCategory[];

/** Categories that are about a specific order (used to nudge the customer to pick one). */
export const ORDER_CATEGORIES: TicketCategory[] = [
  'ORDER_ISSUE',
  'DELIVERY_ISSUE',
  'PAYMENT_ISSUE',
  'MISSING_ITEMS',
  'INCORRECT_ITEMS',
  'QUALITY_ISSUE',
  'REFUND_REQUEST',
];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CUSTOMER: 'Waiting for you',
  WAITING_FOR_RESTAURANT: 'Waiting for restaurant',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function ticketBadgeClass(s: TicketStatus): string {
  switch (s) {
    case 'OPEN':
      return 'badge-accent';
    case 'IN_PROGRESS':
    case 'WAITING_FOR_RESTAURANT':
      return 'badge-violet';
    case 'WAITING_FOR_CUSTOMER':
      return 'badge-warn';
    case 'RESOLVED':
      return 'badge-good';
    default:
      return '';
  }
}

export const TICKET_STATUS_HELP: Record<TicketStatus, string> = {
  OPEN: 'We’ve received your request. A member of our team will reply soon.',
  IN_PROGRESS: 'Someone is working on this. You’ll see their reply here.',
  WAITING_FOR_CUSTOMER: 'We need something from you. Reply below to keep things moving.',
  WAITING_FOR_RESTAURANT: 'We’ve asked the restaurant about this and are waiting to hear back.',
  RESOLVED: 'This ticket has been marked resolved. If the problem isn’t fixed, reply below or open a new ticket.',
  CLOSED: 'This ticket is closed. If you still need help, open a new ticket.',
};

export const isActiveTicket = (t: Pick<Ticket, 'status'>) => t.status !== 'RESOLVED' && t.status !== 'CLOSED';

/** Oldest first, as a chat reads. */
export function sortedMessages(t: Ticket): TicketMessage[] {
  return [...t.messages].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

export function lastActivityAt(t: Ticket): number {
  const latest = t.messages.reduce((n, m) => Math.max(n, Date.parse(m.created_at) || 0), 0);
  return Math.max(latest, Date.parse(t.created_at) || 0);
}

export function latestStaffAt(t: Ticket): string | null {
  const staff = t.messages.filter((m) => m.message_type === 'STAFF_MESSAGE');
  if (!staff.length) return null;
  return staff.reduce((a, b) => (Date.parse(a.created_at) >= Date.parse(b.created_at) ? a : b)).created_at;
}

/* ───────────── Calls ───────────── */

interface Envelope {
  data: Ticket[];
  meta?: { total_items: number };
}
interface PlainPage {
  count: number;
  results: Ticket[];
}

export interface TicketPage {
  tickets: Ticket[];
  total: number;
}

export const supportApi = {
  /**
   * The list endpoint has no status filter, so we load up to 100 (the server's page-size cap) and filter in the
   * browser. It reads the raw body because `call()` would drop the pagination `meta` that tells us the real total.
   */
  async list(): Promise<TicketPage> {
    try {
      const res = await api.get('/support/tickets/', { params: { page_size: 100 } });
      const body = res.data as Envelope | PlainPage | Ticket[];
      if (Array.isArray(body)) return { tickets: body, total: body.length };
      if ('results' in body) return { tickets: body.results, total: body.count };
      return { tickets: body.data, total: body.meta?.total_items ?? body.data.length };
    } catch (e) {
      throw parseError(e);
    }
  },

  get: (id: string) => call<Ticket>(() => api.get(`/support/tickets/${id}/`)),

  create: (input: CreateTicketInput) => call<Ticket>(() => api.post('/support/tickets/', input)),

  /** Text only, or text + one file (multipart). The server stores the file in `attachment`. */
  addMessage(id: string, message: string, file?: File | null) {
    if (file) {
      const body = new FormData();
      body.append('message', message);
      body.append('attachment', file);
      return call<TicketMessage>(() => api.post(`/support/tickets/${id}/add_message/`, body));
    }
    return call<TicketMessage>(() => api.post(`/support/tickets/${id}/add_message/`, { message }));
  },

  async close(id: string): Promise<void> {
    await call<unknown>(() => api.post(`/support/tickets/${id}/close/`));
  },
};
