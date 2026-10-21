import { ordersApi, type Order } from './orders';
import { supportApi, type Ticket } from './support';
import { summarise, type DashboardSummary } from '../dashboard-stats';
import { isActiveTicket, lastActivityAt } from './support';

/**
 * Dashboard data for the restaurant owner.
 *
 * There is no analytics endpoint wired in yet, so the KPIs are worked out from two lists the API already
 * serves to a signed-in owner (orders and support tickets), each scoped to their restaurant by the backend.
 * When an analytics endpoint is available, replace `load()` below and keep the returned shape.
 */

const PAGE = 100;

export interface DashboardData {
  /** Null when the orders request failed. */
  summary: DashboardSummary | null;
  ordersError: string | null;
  /** Active (unresolved) tickets, newest activity first. Null when the tickets request failed. */
  tickets: Ticket[] | null;
  ticketsError: string | null;
  fetchedAt: number;
}

/** The API's default ordering isn't guaranteed, so make sure we hold the newest orders. */
async function loadOrders(): Promise<{ orders: Order[]; total: number }> {
  const first = await ordersApi.list({ page: 1, page_size: PAGE });
  let orders = first.orders;
  const asc = orders.length > 1 && Date.parse(orders[0].created_at) < Date.parse(orders[orders.length - 1].created_at);
  if (asc && first.totalPages > 1) {
    // Oldest-first list: the newest orders are on the last page.
    const last = await ordersApi.list({ page: first.totalPages, page_size: PAGE });
    orders = last.orders;
  }
  return { orders, total: first.totalItems };
}

export async function loadDashboard(): Promise<DashboardData> {
  const [o, t] = await Promise.allSettled([loadOrders(), supportApi.list()]);

  const message = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : 'Something went wrong');

  return {
    summary: o.status === 'fulfilled' ? summarise(o.value.orders, o.value.total) : null,
    ordersError: o.status === 'rejected' ? message(o) : null,
    tickets:
      t.status === 'fulfilled'
        ? t.value.tickets.filter(isActiveTicket).sort((a, b) => lastActivityAt(b) - lastActivityAt(a))
        : null,
    ticketsError: t.status === 'rejected' ? message(t) : null,
    fetchedAt: Date.now(),
  };
}
