import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';

export type StaffRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN_STAFF' | 'DELIVERY_STAFF' | 'STOCK_STAFF';

export interface StaffPermissions {
  can_manage_menu: boolean;
  can_manage_orders: boolean;
  can_manage_staff: boolean;
  can_manage_payments: boolean;
  can_view_analytics: boolean;
}

/**
 * StaffMemberSerializer returns only the email. The name, phone and last sign-in are optional here and
 * shown when the API sends them (see the step 7.6 backend notes).
 */
export interface StaffMember extends StaffPermissions {
  id: string;
  user_email: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  user_name?: string | null;
  user_phone?: string | null;
  last_login?: string | null;
}

export interface StaffCreate extends StaffPermissions {
  staff_email: string;
  role: StaffRole;
}

export type StaffPatch = Partial<StaffPermissions> & { role?: StaffRole };

/** One line of the activity log. Not in the stock backend; see the notes. */
export interface ActivityEntry {
  id: string;
  actor_email: string;
  actor_name?: string | null;
  actor_role?: string | null;
  /** A code such as ORDER_STATUS_CHANGED. */
  action: string;
  /** A ready-to-read sentence, e.g. "Changed order ORD-1042 to Preparing". */
  description: string;
  ip_address?: string | null;
  created_at: string;
}

export interface ActivityParams {
  page?: number;
  actor?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
}

export interface ActivityPage {
  entries: ActivityEntry[];
  hasNext: boolean;
}

interface Envelope<T> { data?: T[]; meta?: { has_next?: boolean; total_pages?: number } }
interface Plain<T> { results: T[]; next?: string | null }

async function listAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  try {
    for (let page = 1; page <= 30; page++) {
      const res = await api.get(path, { params: { page, page_size: 100 } });
      const body = res.data as Envelope<T> | Plain<T> | T[];
      if (Array.isArray(body)) return body;
      if ('results' in body) {
        out.push(...body.results);
        if (!body.next) break;
      } else {
        out.push(...(body.data ?? []));
        if (!body.meta?.has_next && (body.meta?.total_pages ?? 1) <= page) break;
        if (body.meta?.has_next === false) break;
      }
    }
    return out;
  } catch (e) {
    throw parseError(e);
  }
}

export const ACTIVITY_PAGE_SIZE = 25;

export const adminStaffApi = {
  list: () => listAll<StaffMember>('/restaurants/staff/'),
  create: (input: StaffCreate) => call<StaffMember>(() => api.post('/restaurants/staff/', input)),
  update: (id: string, patch: StaffPatch) => call<StaffMember>(() => api.patch(`/restaurants/staff/${id}/`, patch)),
  /** The server flips the flag and answers with the new value. */
  toggleActive: (id: string) => call<{ is_active: boolean }>(() => api.post(`/restaurants/staff/${id}/toggle-active/`)),
  setPermissions: (id: string, perms: Partial<StaffPermissions>) => call<StaffMember>(() => api.post(`/restaurants/staff/${id}/update-permissions/`, perms)),
  async remove(id: string) {
    try {
      await api.delete(`/restaurants/staff/${id}/`);
    } catch (e) {
      throw parseError(e);
    }
  },
  async activity(params: ActivityParams): Promise<ActivityPage> {
    try {
      const res = await api.get('/restaurants/staff/activity/', { params: { ...params, page_size: ACTIVITY_PAGE_SIZE } });
      const body = res.data as Envelope<ActivityEntry> | Plain<ActivityEntry> | ActivityEntry[];
      if (Array.isArray(body)) return { entries: body, hasNext: false };
      if ('results' in body) return { entries: body.results, hasNext: !!body.next };
      const page = params.page ?? 1;
      return { entries: body.data ?? [], hasNext: body.meta?.has_next ?? (body.meta?.total_pages ?? 1) > page };
    } catch (e) {
      throw parseError(e);
    }
  },
};
