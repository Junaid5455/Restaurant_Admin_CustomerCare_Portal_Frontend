import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';
import { ordersApi, type Order, type OrderStatus } from './orders';
import type { OrderType } from './cart';
import { toNumber } from '../format';

/** GET /analytics/dashboard/ */
export interface Overview {
  restaurant_name: string;
  today_orders_count: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_orders: number;
  total_customers: number;
  /** Counted over every non-cart order, cancelled ones included, so the pages don't use the two below. */
  today_sales?: string;
  total_sales?: string;
}

/** One day of delivered orders. `date` is a server (UTC) day like 2026-10-24. */
export interface SalesPoint {
  date: string;
  orders: number;
  sales: number;
  avg: number;
}

export interface PopularItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopCustomer {
  id: string;
  email: string;
  orders: number;
  spent: number;
}

/** Hour of day in the SERVER's time zone (UTC), 0-23. */
export interface PeakHour {
  hour: number;
  orders: number;
}

interface RawSales { date: string; total_orders: number; total_sales: string; average_order_value: string }
interface RawPopular { id: string; name: string; total_quantity_sold: number; total_revenue: string }
interface RawCustomer { customer_id: string; customer_email: string; total_orders: number; total_spent: string }
interface RawPeak { peak_hour: number; order_count: number }

export const ALL_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
export const ALL_TYPES: OrderType[] = ['DINE_IN', 'PICKUP', 'DELIVERY'];

export interface OrderSample {
  /** Newest first. */
  orders: Order[];
  /** How many orders the restaurant has in total. */
  total: number;
  /** True when `orders` is every order the restaurant has. */
  complete: boolean;
}

const SAMPLE_PAGE = 100;

export const adminAnalyticsApi = {
  overview: () => call<Overview>(() => api.get('/analytics/dashboard/')),

  /** The server returns up to 30 days of daily totals (delivered orders only). */
  async sales(): Promise<SalesPoint[]> {
    const rows = await call<RawSales[]>(() => api.get('/analytics/dashboard/sales-report/', { params: { period: 'daily' } }));
    return (rows ?? []).map((r) => ({ date: r.date, orders: r.total_orders, sales: toNumber(r.total_sales), avg: toNumber(r.average_order_value) }));
  },

  async popularItems(): Promise<PopularItem[]> {
    const rows = await call<RawPopular[]>(() => api.get('/analytics/dashboard/popular_items/'));
    return (rows ?? []).map((r) => ({ id: r.id, name: r.name, quantity: r.total_quantity_sold, revenue: toNumber(r.total_revenue) }));
  },

  async customers(): Promise<TopCustomer[]> {
    const rows = await call<RawCustomer[]>(() => api.get('/analytics/dashboard/customer-analytics/'));
    return (rows ?? []).map((r) => ({ id: r.customer_id, email: r.customer_email, orders: r.total_orders, spent: toNumber(r.total_spent) }));
  },

  async peakHours(): Promise<PeakHour[]> {
    const rows = await call<RawPeak[]>(() => api.get('/analytics/dashboard/operational-metrics/'));
    return (rows ?? []).map((r) => ({ hour: r.peak_hour, orders: r.order_count }));
  },

  /** Exact all-time counts: one tiny request per status and per order type, reading only the total from each. */
  async counts(): Promise<{ status: Record<OrderStatus, number>; type: Record<OrderType, number> }> {
    const total = async (params: { status?: OrderStatus; order_type?: OrderType }) => (await ordersApi.list({ ...params, page: 1, page_size: 1 })).totalItems;
    const [s, t] = await Promise.all([Promise.all(ALL_STATUSES.map((x) => total({ status: x }))), Promise.all(ALL_TYPES.map((x) => total({ order_type: x })))]);
    return {
      status: Object.fromEntries(ALL_STATUSES.map((x, i) => [x, s[i]])) as Record<OrderStatus, number>,
      type: Object.fromEntries(ALL_TYPES.map((x, i) => [x, t[i]])) as Record<OrderType, number>,
    };
  },

  /**
   * The latest orders (up to `maxPages` x 100), newest first. The API has no date filter, so this is the base for
   * anything that needs to look inside orders (dishes, days of the week). It copes with either list ordering.
   */
  async sample(maxPages = 5): Promise<OrderSample> {
    const first = await ordersApi.list({ page: 1, page_size: SAMPLE_PAGE });
    const asc = first.orders.length > 1 && Date.parse(first.orders[0].created_at) < Date.parse(first.orders[first.orders.length - 1].created_at);
    const wanted: number[] = [];
    if (asc) for (let p = first.totalPages; p >= Math.max(1, first.totalPages - maxPages + 1); p--) wanted.push(p);
    else for (let p = 1; p <= Math.min(first.totalPages, maxPages); p++) wanted.push(p);
    const rest = await Promise.all(wanted.filter((p) => p !== 1).map((p) => ordersApi.list({ page: p, page_size: SAMPLE_PAGE })));
    const orders = [...(wanted.includes(1) ? first.orders : []), ...rest.flatMap((r) => r.orders)].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return { orders, total: first.totalItems, complete: orders.length >= first.totalItems };
  },

  /** GET /analytics/dashboard/export-sales/: the last 30 days of orders as a CSV file. */
  async exportSales(): Promise<{ blob: Blob; filename: string }> {
    try {
      const res = await api.get('/analytics/dashboard/export-sales/', { responseType: 'blob' });
      const cd = String(res.headers?.['content-disposition'] ?? '');
      const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      return { blob: res.data as Blob, filename: m ? decodeURIComponent(m[1]) : 'sales_report.csv' };
    } catch (e) {
      throw parseError(e);
    }
  },
};
