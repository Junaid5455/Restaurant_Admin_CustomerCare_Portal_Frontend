import type { AdminDelivery, DeliveryStatus } from './api/admin-delivery';
import type { StaffMember } from './api/admin-staff';
import { displayName } from './staff';

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  PENDING: 'Needs a driver',
  ASSIGNED: 'Driver assigned',
  PICKED_UP: 'On the way',
  IN_TRANSIT: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const DELIVERY_BADGE: Record<DeliveryStatus, string> = {
  PENDING: 'badge-warn',
  ASSIGNED: 'badge-accent',
  PICKED_UP: 'badge-violet',
  IN_TRANSIT: 'badge-violet',
  DELIVERED: 'badge-good',
  CANCELLED: 'badge-crit',
};

export const isFinished = (s: DeliveryStatus) => s === 'DELIVERED' || s === 'CANCELLED';
export const isOnTheRoad = (s: DeliveryStatus) => s === 'PICKED_UP' || s === 'IN_TRANSIT';

/** "Needs a driver" is judged by the driver field, not only the status, so a row that lost its driver still shows up. */
export const needsDriver = (d: Pick<AdminDelivery, 'status' | 'driver'>) => !isFinished(d.status) && !d.driver;

export type Bucket = 'all' | 'needs' | 'active' | 'done';
export const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs', label: 'Needs a driver' },
  { id: 'active', label: 'In progress' },
  { id: 'done', label: 'Finished' },
];

export function inBucket(d: AdminDelivery, b: Bucket): boolean {
  if (b === 'all') return true;
  if (b === 'needs') return needsDriver(d);
  if (b === 'active') return !isFinished(d.status) && !!d.driver;
  return isFinished(d.status);
}

/** The delivery is due this many minutes after the driver is on the way, or after it was created if not yet. */
export function dueAt(d: AdminDelivery): number | null {
  if (d.estimated_delivery_time_minutes == null) return null;
  const start = Date.parse(d.created_at);
  return Number.isNaN(start) ? null : start + d.estimated_delivery_time_minutes * 60_000;
}

/** Whole minutes late (positive) or still to go (negative); null when finished or unknown. */
export function minutesLate(d: AdminDelivery, now: number): number | null {
  if (isFinished(d.status)) return null;
  const due = dueAt(d);
  return due === null ? null : Math.round((now - due) / 60_000);
}

export function etaText(d: AdminDelivery, now: number): { text: string; late: boolean } | null {
  const m = minutesLate(d, now);
  if (m === null) return null;
  if (m > 0) return { text: `${m} min late`, late: true };
  if (m === 0) return { text: 'Due now', late: false };
  return { text: `Due in ${-m} min`, late: false };
}

export function hasPin(d: Pick<AdminDelivery, 'current_latitude' | 'current_longitude'>): boolean {
  const la = Number(d.current_latitude), lo = Number(d.current_longitude);
  return d.current_latitude != null && d.current_longitude != null && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

/** A location older than this is probably the phone being off or the driver not sharing. */
export const STALE_MS = 5 * 60_000;
export const pinAge = (d: Pick<AdminDelivery, 'last_location_update'>, now: number): number | null => (d.last_location_update ? now - Date.parse(d.last_location_update) : null);
export const pinIsStale = (d: AdminDelivery, now: number) => {
  const age = pinAge(d, now);
  return age === null || age > STALE_MS;
};

export const mapsLinkForPin = (d: Pick<AdminDelivery, 'current_latitude' | 'current_longitude'>) => `https://www.openstreetmap.org/?mlat=${d.current_latitude}&mlon=${d.current_longitude}#map=16/${d.current_latitude}/${d.current_longitude}`;
export const mapsLinkForAddress = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** The active drivers an owner can pick from. */
export const activeDrivers = (staff: StaffMember[]) => staff.filter((m) => m.role === 'DELIVERY_STAFF' && m.is_active);
export const driverLabel = (d: Pick<AdminDelivery, 'driver_name'>, staff?: StaffMember[], id?: string | null) => {
  const m = staff?.find((s) => s.id === id);
  if (m) return displayName(m);
  return d.driver_name ? displayName({ user_email: d.driver_name }) : 'Driver';
};

/** Only the assigned driver can pick up or deliver on the stock backend. */
export type Step = 'pickup' | 'deliver';
export function nextStep(d: Pick<AdminDelivery, 'status'>): Step | null {
  if (d.status === 'PENDING' || d.status === 'ASSIGNED') return 'pickup';
  if (d.status === 'PICKED_UP') return 'deliver';
  return null;
}
export const STEP_LABEL: Record<Step, string> = { pickup: 'Mark picked up', deliver: 'Mark delivered' };

export function timeline(d: AdminDelivery): { key: string; label: string; at: string | null }[] {
  const steps = [
    { key: 'created', label: 'Delivery created', at: d.created_at },
    { key: 'assigned', label: 'Driver assigned', at: d.assigned_at },
    { key: 'picked', label: 'Picked up', at: d.picked_up_at },
    { key: 'delivered', label: 'Delivered', at: d.delivered_at },
  ];
  return steps;
}

export const minutesBetween = (a: string | null, b: string | null) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60_000)) : null);
