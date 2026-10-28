import type { StaffMember, StaffPermissions, StaffRole } from './api/admin-staff';

export const PERMISSIONS: { key: keyof StaffPermissions; label: string; hint: string }[] = [
  { key: 'can_manage_menu', label: 'Manage the menu', hint: 'Add and edit dishes, prices and availability' },
  { key: 'can_manage_orders', label: 'Manage orders', hint: 'See orders and move them through the kitchen' },
  { key: 'can_manage_payments', label: 'Handle payments', hint: 'See payments and issue refunds' },
  { key: 'can_view_analytics', label: 'View analytics', hint: 'See sales and performance reports' },
  { key: 'can_manage_staff', label: 'Manage staff', hint: 'Add people and change their access' },
];

const none: StaffPermissions = { can_manage_menu: false, can_manage_orders: false, can_manage_staff: false, can_manage_payments: false, can_view_analytics: false };

/** Suggested starting permissions per role. The owner can change any of them. */
export const ROLES: { id: StaffRole; label: string; blurb: string; defaults: StaffPermissions }[] = [
  { id: 'ADMIN', label: 'Admin', blurb: 'Runs the restaurant day to day, with every permission.', defaults: { can_manage_menu: true, can_manage_orders: true, can_manage_staff: true, can_manage_payments: true, can_view_analytics: true } },
  { id: 'MANAGER', label: 'Manager', blurb: 'Looks after the menu, orders and reports.', defaults: { ...none, can_manage_menu: true, can_manage_orders: true, can_view_analytics: true } },
  { id: 'CASHIER', label: 'Cashier', blurb: 'Takes orders and handles payments.', defaults: { ...none, can_manage_orders: true, can_manage_payments: true } },
  { id: 'KITCHEN_STAFF', label: 'Kitchen staff', blurb: 'Prepares orders on the kitchen screen.', defaults: { ...none, can_manage_orders: true } },
  { id: 'DELIVERY_STAFF', label: 'Delivery staff', blurb: 'Delivers orders to guests.', defaults: { ...none, can_manage_orders: true } },
  { id: 'STOCK_STAFF', label: 'Stock staff', blurb: 'Keeps the menu and availability up to date.', defaults: { ...none, can_manage_menu: true } },
];

export const roleLabel = (r: string) => ROLES.find((x) => x.id === r)?.label ?? r;
export const roleDefaults = (r: StaffRole): StaffPermissions => ({ ...(ROLES.find((x) => x.id === r)?.defaults ?? none) });

export const pickPermissions = (m: StaffPermissions): StaffPermissions => ({
  can_manage_menu: !!m.can_manage_menu,
  can_manage_orders: !!m.can_manage_orders,
  can_manage_staff: !!m.can_manage_staff,
  can_manage_payments: !!m.can_manage_payments,
  can_view_analytics: !!m.can_view_analytics,
});

export const samePermissions = (a: StaffPermissions, b: StaffPermissions) => PERMISSIONS.every((p) => !!a[p.key] === !!b[p.key]);

/** The API returns only an email, so a readable name comes from it ("kamran.ali@x.com" -> "Kamran Ali") unless it sends one. */
export function displayName(m: Pick<StaffMember, 'user_email' | 'user_name'>): string {
  if (m.user_name?.trim()) return m.user_name.trim();
  const local = m.user_email.split('@')[0] ?? m.user_email;
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || m.user_email;
}

export type ActivityCategory = 'orders' | 'menu' | 'staff' | 'settings' | 'auth' | 'other';

export const ACTIVITY_CATEGORIES: { id: ActivityCategory; label: string; icon: string }[] = [
  { id: 'orders', label: 'Orders', icon: '📋' },
  { id: 'menu', label: 'Menu', icon: '🍕' },
  { id: 'staff', label: 'Staff', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'auth', label: 'Sign-ins', icon: '🔑' },
  { id: 'other', label: 'Other', icon: '•' },
];

/** ORDER_STATUS_CHANGED -> orders, MENU_ITEM_UPDATED -> menu, LOGIN -> auth. */
export function categoryOf(action: string): ActivityCategory {
  const a = action.toUpperCase();
  if (a.startsWith('ORDER') || a.startsWith('REFUND') || a.startsWith('KITCHEN')) return 'orders';
  if (a.startsWith('MENU') || a.startsWith('CATEGORY') || a.startsWith('ITEM')) return 'menu';
  if (a.startsWith('STAFF')) return 'staff';
  if (a.startsWith('SETTINGS') || a.startsWith('RESTAURANT') || a.startsWith('HOURS') || a.startsWith('ZONE')) return 'settings';
  if (a.startsWith('LOGIN') || a.startsWith('LOGOUT') || a.startsWith('AUTH') || a.startsWith('PASSWORD')) return 'auth';
  return 'other';
}

export const categoryIcon = (action: string) => ACTIVITY_CATEGORIES.find((c) => c.id === categoryOf(action))?.icon ?? '•';

/** "Today", "Yesterday", or a long date, for grouping the log. */
export function dayLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (key(d) === key(new Date(now))) return 'Today';
  if (key(d) === key(new Date(now - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
