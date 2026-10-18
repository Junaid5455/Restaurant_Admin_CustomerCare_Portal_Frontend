export interface PickupSlot {
  /** ISO timestamp sent to the API. */
  value: string;
  label: string;
}

const STEP_MIN = 15;

function parseClock(t?: string | null): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Pickup times in 15-minute steps, starting after the kitchen's prep time and ending when the restaurant closes
 * (local clock). Without closing hours it offers the next three hours. Slots never cross midnight.
 */
export function pickupSlots(now: Date, prepMinutes: number, closingTime?: string | null): PickupSlot[] {
  const first = new Date(now.getTime() + Math.max(prepMinutes, 10) * 60_000);
  first.setSeconds(0, 0);
  first.setMinutes(Math.ceil(first.getMinutes() / STEP_MIN) * STEP_MIN);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 0, 0);

  const closing = parseClock(closingTime);
  let last = new Date(first.getTime() + 3 * 60 * 60_000);
  if (closing !== null) {
    last = new Date(now);
    last.setHours(Math.floor(closing / 60), closing % 60, 0, 0);
  }
  if (last > endOfDay) last = endOfDay;

  const slots: PickupSlot[] = [];
  for (let t = first; t <= last && slots.length < 32; t = new Date(t.getTime() + STEP_MIN * 60_000)) {
    slots.push({ value: t.toISOString(), label: timeFmt.format(t) });
  }
  return slots;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeFmt.format(d)}`;
}
