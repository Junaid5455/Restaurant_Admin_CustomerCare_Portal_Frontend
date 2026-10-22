'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryGate, SaveBar, SettingsFrame, mapSaveError } from './settings-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextArea } from '@/components/ui/text-area';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useRestaurantSettings, useSaveSettings, useUnsavedWarning } from '@/hooks/use-restaurant-settings';
import { parsePostalCodes, restaurantSettingsApi, type RestaurantSettings, type Zone, type ZoneInput } from '@/lib/api/restaurant-settings';
import { parseError } from '@/lib/errors';
import { formatMoney, toNumber } from '@/lib/format';
import { CURRENCY_SYMBOL } from '@/lib/constants';

/* ───────────── How guests can order ───────────── */

function ServiceForm({ s }: { s: RestaurantSettings }) {
  const { push } = useToast();
  const save = useSaveSettings();
  const base = { pickup: s.allows_pickup, delivery: s.allows_delivery, dine: s.allows_dine_in, time: String(s.delivery_time_minutes) };
  const [v, setV] = useState(base);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = v.pickup !== base.pickup || v.delivery !== base.delivery || v.dine !== base.dine || v.time !== base.time;
  useUnsavedWarning(dirty);
  const none = !v.pickup && !v.delivery && !v.dine;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const mins = Number(v.time);
    if (!/^\d+$/.test(v.time.trim()) || mins < 5 || mins > 240) {
      setTimeError('Enter whole minutes between 5 and 240');
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setTimeError(undefined);
    if (none) { setFormError('Turn on at least one way for guests to order.'); return; }
    const patch: Record<string, boolean | number> = {};
    if (v.pickup !== base.pickup) patch.allows_pickup = v.pickup;
    if (v.delivery !== base.delivery) patch.allows_delivery = v.delivery;
    if (v.dine !== base.dine) patch.allows_dine_in = v.dine;
    if (v.time !== base.time) patch.delivery_time_minutes = mins;
    try {
      await save.mutateAsync(patch);
      push('Ordering options saved');
    } catch (err) {
      const m = mapSaveError(err, ['delivery_time_minutes']);
      setTimeError(m.fields.delivery_time_minutes);
      setFormError(m.form);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="ad-stack">
      <section className="card ad-card-pad" aria-labelledby="dz-how">
        <h2 id="dz-how" className="ad-card-title">How guests can order</h2>
        <Switch label="Pickup" description="Guests collect their order at the restaurant." checked={v.pickup} onChange={(pickup) => setV({ ...v, pickup })} />
        <Switch label="Delivery" description="You bring the order to the guest." checked={v.delivery} onChange={(delivery) => setV({ ...v, delivery })} />
        <Switch label="Dine in" description="Guests order for a table at the restaurant." checked={v.dine} onChange={(dine) => setV({ ...v, dine })} />
        <TextField
          label="Typical delivery time (minutes)"
          inputMode="numeric"
          value={v.time}
          onChange={(e) => { setV({ ...v, time: e.target.value }); setTimeError(undefined); }}
          error={timeError}
          hint="Shown to guests on your restaurant page."
          style={{ maxWidth: 220 }}
        />
      </section>
      <SaveBar dirty={dirty} busy={save.isPending} error={formError} onDiscard={() => { setV(base); setTimeError(undefined); setFormError(null); }} />
    </form>
  );
}

/* ───────────── Zones ───────────── */

const ZONES_KEY = ['restaurant-zones'] as const;
const sortZones = (z: Zone[]) => [...z].sort((a, b) => a.zone_name.localeCompare(b.zone_name));

interface ZoneDraft { name: string; fee: string; time: string; codes: string; active: boolean }
const emptyDraft: ZoneDraft = { name: '', fee: '', time: '30', codes: '', active: true };
const toDraft = (z: Zone): ZoneDraft => ({ name: z.zone_name, fee: String(toNumber(z.delivery_fee)), time: String(z.delivery_time_minutes), codes: parsePostalCodes(z.postal_codes).join(', '), active: z.is_active });

function ZoneModal({ zone, onClose, others }: { zone: Zone | null; onClose: () => void; others: Zone[] }) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [d, setD] = useState<ZoneDraft>(zone ? toDraft(zone) : emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'fee' | 'time' | 'codes', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codes = parsePostalCodes(d.codes);
  const overlap = useMemo(() => {
    const mine = new Set(codes.map((c) => c.toLowerCase()));
    return others.filter((o) => o.is_active && parsePostalCodes(o.postal_codes).some((c) => mine.has(c.toLowerCase()))).map((o) => o.zone_name);
  }, [codes, others]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    if (!d.name.trim()) found.name = 'Give this zone a name';
    else if (d.name.trim().length > 100) found.name = 'Keep the name under 100 characters';
    const fee = Number(d.fee);
    if (d.fee.trim() === '' || Number.isNaN(fee) || fee < 0) found.fee = 'Enter a fee of 0 or more';
    else if (fee >= 1_000_000) found.fee = 'That fee is too large';
    if (!/^\d+$/.test(d.time.trim()) || Number(d.time) < 5 || Number(d.time) > 240) found.time = 'Enter whole minutes between 5 and 240';
    if (!codes.length) found.codes = 'Add at least one postal code';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.sv-modal [aria-invalid="true"]')?.focus());
      return;
    }
    const body: ZoneInput = { zone_name: d.name.trim(), delivery_fee: fee.toFixed(2), delivery_time_minutes: Number(d.time), postal_codes: codes.join(', '), is_active: d.active };
    setBusy(true);
    try {
      const saved = zone ? await restaurantSettingsApi.updateZone(zone.id, body) : await restaurantSettingsApi.addZone(body);
      qc.setQueryData<Zone[]>(ZONES_KEY, (old) => sortZones([...(old ?? []).filter((z) => z.id !== saved.id), saved]));
      push(zone ? 'Zone updated' : 'Zone added');
      onClose();
    } catch (err) {
      const m = mapSaveError(err, ['zone_name', 'delivery_fee', 'delivery_time_minutes', 'postal_codes']);
      setErrors({ name: m.fields.zone_name, fee: m.fields.delivery_fee, time: m.fields.delivery_time_minutes, codes: m.fields.postal_codes });
      setFormError(m.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} labelledBy="zone-title">
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body">
            <h2 id="zone-title" className="sv-modal-title">{zone ? 'Edit delivery zone' : 'Add a delivery zone'}</h2>
            {formError && <Alert>{formError}</Alert>}
            <TextField label="Zone name" value={d.name} maxLength={100} placeholder="e.g. Clifton" onChange={(e) => { setD({ ...d, name: e.target.value }); setErrors((x) => ({ ...x, name: undefined })); }} error={errors.name} />
            <div className="ad-two">
              <TextField label={`Delivery fee (${CURRENCY_SYMBOL})`} inputMode="decimal" value={d.fee} onChange={(e) => { setD({ ...d, fee: e.target.value }); setErrors((x) => ({ ...x, fee: undefined })); }} error={errors.fee} />
              <TextField label="Delivery time (min)" inputMode="numeric" value={d.time} onChange={(e) => { setD({ ...d, time: e.target.value }); setErrors((x) => ({ ...x, time: undefined })); }} error={errors.time} />
            </div>
            <TextArea label="Postal codes" rows={3} value={d.codes} onChange={(e) => { setD({ ...d, codes: e.target.value }); setErrors((x) => ({ ...x, codes: undefined })); }} error={errors.codes}
              hint={codes.length ? `${codes.length} code${codes.length === 1 ? '' : 's'}: separate with commas, spaces or new lines.` : 'Separate with commas, spaces or new lines.'} />
            {overlap.length > 0 && <Alert kind="info">These codes are also covered by {overlap.join(', ')}. Guests are matched to the zone that lists their code, so check this is what you want.</Alert>}
            <Switch label="Active" description="Inactive zones are kept but not used." checked={d.active} onChange={(active) => setD({ ...d, active })} />
          </div>
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <Button type="submit" loading={busy} loadingText="Saving…">{zone ? 'Save zone' : 'Add zone'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Zones({ allowsDelivery }: { allowsDelivery: boolean }) {
  const { push } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ZONES_KEY, queryFn: async () => sortZones(await restaurantSettingsApi.zones()), retry: false });
  const [editing, setEditing] = useState<Zone | 'new' | null>(null);
  const [toRemove, setToRemove] = useState<Zone | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => restaurantSettingsApi.removeZone(id),
    onSuccess: (_, id) => qc.setQueryData<Zone[]>(ZONES_KEY, (old) => (old ?? []).filter((z) => z.id !== id)),
  });

  async function toggle(z: Zone) {
    setBusyId(z.id);
    try {
      const saved = await restaurantSettingsApi.updateZone(z.id, { is_active: !z.is_active });
      qc.setQueryData<Zone[]>(ZONES_KEY, (old) => sortZones((old ?? []).map((x) => (x.id === z.id ? saved : x))));
    } catch (err) {
      push(parseError(err).display, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!toRemove) return;
    try {
      await remove.mutateAsync(toRemove.id);
      push('Zone removed');
    } catch (err) {
      push(parseError(err).display, 'error');
    } finally {
      setToRemove(null);
    }
  }

  const zones = q.data ?? [];
  const active = zones.filter((z) => z.is_active);
  const overlaps = useMemo(() => {
    const byCode = new Map<string, string[]>();
    for (const z of active) for (const c of parsePostalCodes(z.postal_codes)) byCode.set(c.toLowerCase(), [...(byCode.get(c.toLowerCase()) ?? []), z.zone_name]);
    const out = new Map<string, string[]>();
    for (const z of active) {
      const clash = new Set<string>();
      for (const c of parsePostalCodes(z.postal_codes)) for (const n of byCode.get(c.toLowerCase()) ?? []) if (n !== z.zone_name) clash.add(n);
      if (clash.size) out.set(z.id, [...clash]);
    }
    return out;
  }, [active]);

  return (
    <section className="card ad-card-pad" aria-labelledby="dz-zones">
      <div className="ad-rowhead">
        <h2 id="dz-zones" className="ad-card-title">Delivery zones</h2>
        <Button type="button" variant="ghost" onClick={() => setEditing('new')}>+ Add zone</Button>
      </div>
      <p className="ad-note">
        Guests whose address is outside your active zones are warned at checkout. With no active zones, you deliver everywhere.
        Orders are currently charged your standard delivery fee from Tax &amp; fees; a zone&apos;s own fee and time are recorded for you.
      </p>
      {!allowsDelivery && <Alert kind="info">Delivery is switched off above, so zones aren&apos;t used right now.</Alert>}

      {q.isPending && <div className="ad-skel" style={{ height: 120 }} aria-busy="true" aria-label="Loading" />}
      {q.isError && (
        <Alert>
          Couldn&apos;t load your zones: {parseError(q.error).display}{' '}
          <button type="button" className="ad-link" onClick={() => q.refetch()}>Try again</button>
        </Alert>
      )}
      {q.data && zones.length === 0 && (
        <div className="ad-empty ad-empty-flush">
          <div className="ad-empty-icon" aria-hidden="true">🗺️</div>
          <strong>No delivery zones yet</strong>
          <span>Add a zone to limit delivery to certain postal codes and set its fee.</span>
        </div>
      )}
      {zones.length > 0 && (
        <ul className="ad-zones">
          {zones.map((z) => {
            const codes = parsePostalCodes(z.postal_codes);
            const clash = overlaps.get(z.id);
            return (
              <li key={z.id} className={z.is_active ? '' : 'is-off'}>
                <div className="ad-zone-main">
                  <div className="ad-list-title">{z.zone_name} {!z.is_active && <span className="badge badge-neutral">Inactive</span>}</div>
                  <div className="ad-list-sub">{formatMoney(z.delivery_fee)} fee · about {z.delivery_time_minutes} min</div>
                  <div className="ad-codes" aria-label={`Postal codes for ${z.zone_name}`}>
                    {codes.slice(0, 8).map((c) => <span key={c} className="ad-code">{c}</span>)}
                    {codes.length > 8 && <span className="ad-code more">+{codes.length - 8} more</span>}
                  </div>
                  {clash && <p className="ad-warn">Shares postal codes with {clash.join(', ')}</p>}
                </div>
                <div className="ad-zone-actions">
                  <button type="button" className="ad-link" onClick={() => toggle(z)} disabled={busyId === z.id} aria-label={`${z.is_active ? 'Deactivate' : 'Activate'} ${z.zone_name}`}>
                    {z.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="ad-link" onClick={() => setEditing(z)} aria-label={`Edit ${z.zone_name}`}>Edit</button>
                  <button type="button" className="ad-link danger" onClick={() => setToRemove(z)} aria-label={`Delete ${z.zone_name}`}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ZoneModal
          key={editing === 'new' ? 'new' : editing.id}
          zone={editing === 'new' ? null : editing}
          others={zones.filter((z) => editing === 'new' || z.id !== editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
      {toRemove && (
        <ConfirmDialog
          title={`Delete ${toRemove.zone_name}?`}
          message="Guests in these postal codes will no longer be matched to this zone. This can't be undone."
          confirmLabel="Delete zone"
          busy={remove.isPending}
          onClose={() => !remove.isPending && setToRemove(null)}
          onConfirm={confirmRemove}
        />
      )}
    </section>
  );
}

export function DeliveryZonesView() {
  const q = useRestaurantSettings();
  return (
    <SettingsFrame active="delivery">
      <QueryGate query={q}>{(s) => <><ServiceForm s={s} /><Zones allowsDelivery={s.allows_delivery} /></>}</QueryGate>
    </SettingsFrame>
  );
}
