'use client';

import { useState, type FormEvent } from 'react';
import { MiniSwitch } from './menu-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { menuError, useMenuCache } from '@/hooks/use-admin-menu';
import { adminMenuApi, type AddOn, type Customization, type CustomizationOption, type CustomizationType, type MenuItemDetail } from '@/lib/api/admin-menu';
import { ApiError, parseError } from '@/lib/errors';
import { CURRENCY_SYMBOL } from '@/lib/constants';
import { formatModifier, formatMoney, toNumber } from '@/lib/format';

export const TYPE_LABEL: Record<CustomizationType, string> = {
  SINGLE_SELECT: 'Choose one',
  MULTIPLE_SELECT: 'Choose several',
  TEXT_INPUT: 'Free text',
};

const TYPE_HELP: Record<CustomizationType, string> = {
  SINGLE_SELECT: 'Guests pick exactly one option, like a size or a spice level.',
  MULTIPLE_SELECT: 'Guests can pick any number of options, like toppings.',
  TEXT_INPUT: 'Guests type a note, like "no onions". No options needed.',
};

/** The stock backend has no endpoint for options; say so plainly instead of showing "Not found". */
function optionError(e: unknown): string {
  const err = parseError(e);
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
    return "Options can't be saved yet: the server has no endpoint for them. See the backend notes for step 7.4.";
  }
  return menuError(e);
}

function money(v: string, allowNegative: boolean): number | null {
  const t = v.trim();
  if (t === '') return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return NaN;
  const n = Number(t);
  return !allowNegative && n < 0 ? NaN : n;
}

// ── Options ──────────────────────────────────────────────────────────────────────────────────────────────

function OptionForm({ initial, onSave, onCancel }: { initial?: CustomizationOption; onSave: (name: string, modifier: number) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(toNumber(initial.price_modifier)) : '');
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    const found: typeof errors = {};
    if (!name.trim()) found.name = 'Name this option';
    else if (name.trim().length > 100) found.name = 'Keep it under 100 characters';
    const p = money(price, true);
    if (Number.isNaN(p)) found.price = 'Enter an amount like 50 or -20';
    else if (p !== null && Math.abs(p) >= 100_000) found.price = 'That amount is too large';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => (e.target as HTMLElement).querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      await onSave(name.trim(), p ?? 0);
    } catch (err) {
      setError(optionError(err));
      setBusy(false);
    }
  }

  return (
    <form className="ad-inline-form ad-option-form" onSubmit={submit} noValidate>
      <TextField label="Option name" value={name} maxLength={100} placeholder="e.g. Large" onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} error={errors.name} />
      <TextField label={`Price change (${CURRENCY_SYMBOL})`} inputMode="decimal" value={price} placeholder="0" onChange={(e) => { setPrice(e.target.value); setErrors((x) => ({ ...x, price: undefined })); }} error={errors.price} hint="Added to the dish price. Use a minus for a discount." />
      <div className="ad-actions">
        <Button type="submit" loading={busy} loadingText="Saving…">{initial ? 'Save option' : 'Add option'}</Button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      {error && <Alert>{error}</Alert>}
    </form>
  );
}

// ── Customization groups ─────────────────────────────────────────────────────────────────────────────────

function GroupModal({ item, group, onClose }: { item: MenuItemDetail; group: Customization | null; onClose: () => void }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const [name, setName] = useState(group?.name ?? '');
  const [type, setType] = useState<CustomizationType>(group?.type ?? 'SINGLE_SELECT');
  const [required, setRequired] = useState(group?.is_required ?? false);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const n = name.trim();
    if (!n) return setError('Name this choice, like "Size" or "Spice level"');
    if (n.length > 100) return setError('Keep the name under 100 characters');
    setBusy(true);
    try {
      if (group) {
        const saved = await adminMenuApi.updateCustomization(group.id, { name: n, type, is_required: required });
        cache.patchDetail(item.id, (d) => ({ ...d, customizations: d.customizations.map((c) => (c.id === group.id ? { ...c, ...saved, options: c.options } : c)) }));
      } else {
        const saved = await adminMenuApi.createCustomization(item.id, { name: n, type, is_required: required });
        cache.patchDetail(item.id, (d) => ({ ...d, customizations: [...d.customizations, { ...saved, options: saved.options ?? [] }] }));
      }
      push(group ? 'Choice saved' : 'Choice added');
      onClose();
    } catch (err) {
      setFormError(menuError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} labelledBy="grp-title">
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body">
            <h2 id="grp-title" className="sv-modal-title">{group ? 'Edit choice' : 'Add a choice'}</h2>
            {formError && <Alert>{formError}</Alert>}
            <TextField label="Name" value={name} maxLength={100} placeholder="e.g. Size" onChange={(e) => { setName(e.target.value); setError(undefined); }} error={error} />
            <div className="field">
              <label className="field-label" htmlFor="grp-type">How guests choose</label>
              <select id="grp-type" className="ad-select" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value as CustomizationType)}>
                {(Object.keys(TYPE_LABEL) as CustomizationType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
              <p className="field-hint">{TYPE_HELP[type]}</p>
            </div>
            <Switch label="Required" description="Guests must answer before they can add the dish to their cart." checked={required} onChange={setRequired} />
          </div>
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <Button type="submit" loading={busy} loadingText="Saving…">{group ? 'Save choice' : 'Add choice'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Group({ item, group, onEdit, onDelete }: { item: MenuItemDetail; group: Customization; onEdit: () => void; onDelete: () => void }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CustomizationOption | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const hasOptions = group.type !== 'TEXT_INPUT';

  const setOptions = (fn: (o: CustomizationOption[]) => CustomizationOption[]) =>
    cache.patchDetail(item.id, (d) => ({ ...d, customizations: d.customizations.map((c) => (c.id === group.id ? { ...c, options: fn(c.options) } : c)) }));

  async function addOption(name: string, modifier: number) {
    const saved = await adminMenuApi.createOption(group.id, { name, price_modifier: modifier.toFixed(2), order: group.options.length });
    setOptions((o) => [...o, saved]);
    setAdding(false);
    push('Option added');
  }

  async function saveOption(opt: CustomizationOption, name: string, modifier: number) {
    const saved = await adminMenuApi.updateOption(opt.id, { name, price_modifier: modifier.toFixed(2) });
    setOptions((o) => o.map((x) => (x.id === opt.id ? { ...x, ...saved } : x)));
    setEditing(null);
    push('Option saved');
  }

  async function removeOption(opt: CustomizationOption) {
    setRemoveBusy(true);
    try {
      await adminMenuApi.deleteOption(opt.id);
      setOptions((o) => o.filter((x) => x.id !== opt.id));
      setRemoving(null);
      push(`${opt.name} removed`);
    } catch (e) {
      push(optionError(e), 'error');
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <li className="ad-group">
      <div className="ad-group-head">
        <div className="ad-list-main">
          <div className="ad-list-title">{group.name}</div>
          <div className="ad-list-sub">
            <span className="badge badge-violet">{TYPE_LABEL[group.type]}</span>{' '}
            <span className={`badge ${group.is_required ? 'badge-accent' : 'badge-neutral'}`}>{group.is_required ? 'Required' : 'Optional'}</span>
          </div>
        </div>
        <div className="ad-row-tools">
          <button type="button" className="ad-link" aria-label={`Edit choice ${group.name}`} onClick={onEdit}>Edit</button>
          <button type="button" className="ad-link danger" aria-label={`Delete choice ${group.name}`} onClick={onDelete}>Delete</button>
        </div>
      </div>

      {hasOptions && (
        <>
          {group.options.length === 0 && !adding && <p className="ad-muted ad-pad-l">No options yet. Guests can&apos;t choose anything until you add some.</p>}
          <ul className="ad-options" aria-label={`Options for ${group.name}`}>
            {group.options.map((o) =>
              editing === o.id ? (
                <li key={o.id}>
                  <OptionForm initial={o} onSave={(n, m) => saveOption(o, n, m)} onCancel={() => setEditing(null)} />
                </li>
              ) : (
                <li key={o.id}>
                  <span className="ad-option-name">{o.name}</span>
                  <span className="ad-muted">{formatModifier(o.price_modifier) || 'No extra charge'}</span>
                  <span className="ad-row-tools">
                    <button type="button" className="ad-link" aria-label={`Edit option ${o.name}`} onClick={() => { setAdding(false); setEditing(o.id); }}>Edit</button>
                    <button type="button" className="ad-link danger" aria-label={`Remove option ${o.name}`} onClick={() => setRemoving(o)}>Remove</button>
                  </span>
                </li>
              ),
            )}
          </ul>
          {adding ? (
            <OptionForm onSave={addOption} onCancel={() => setAdding(false)} />
          ) : (
            <button type="button" className="ad-link ad-pad-l" onClick={() => { setEditing(null); setAdding(true); }}>+ Add option</button>
          )}
        </>
      )}
      {removing && (
        <ConfirmDialog title={`Remove ${removing.name}?`} message="Guests will no longer see this option." confirmLabel="Remove option" busy={removeBusy} onConfirm={() => removeOption(removing)} onClose={() => !removeBusy && setRemoving(null)} />
      )}
    </li>
  );
}

export function CustomizationsCard({ item }: { item: MenuItemDetail }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const [editing, setEditing] = useState<Customization | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Customization | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(c: Customization) {
    setBusy(true);
    try {
      await adminMenuApi.deleteCustomization(c.id);
      cache.patchDetail(item.id, (d) => ({ ...d, customizations: d.customizations.filter((x) => x.id !== c.id) }));
      push(`${c.name} deleted`);
      setDeleting(null);
    } catch (e) {
      push(menuError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card ad-card-pad" aria-labelledby="cz-title">
      <div className="ad-rowhead">
        <div>
          <h2 id="cz-title" className="ad-rowhead-title">Customizations</h2>
          <p className="ad-muted" style={{ margin: '4px 0 0' }}>Choices guests make when ordering, such as size, spice level or toppings.</p>
        </div>
        <Button variant="ghost" onClick={() => setEditing('new')}>+ Add choice</Button>
      </div>
      {item.customizations.length === 0 ? (
        <p className="ad-muted" style={{ margin: 0 }}>No customizations. Guests order this dish as it is.</p>
      ) : (
        <ul className="ad-groups" aria-label="Customizations">
          {item.customizations.map((c) => (
            <Group key={c.id} item={item} group={c} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
          ))}
        </ul>
      )}
      {editing && <GroupModal item={item} group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog title={`Delete ${deleting.name}?`} message="This choice and all of its options are removed from the dish. Past orders aren't affected." confirmLabel="Delete choice" busy={busy} onConfirm={() => remove(deleting)} onClose={() => !busy && setDeleting(null)} />
      )}
    </section>
  );
}

// ── Add-ons ──────────────────────────────────────────────────────────────────────────────────────────────

function AddOnForm({ initial, onSave, onCancel }: { initial?: AddOn; onSave: (name: string, price: number) => Promise<void>; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(toNumber(initial.price)) : '');
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const found: typeof errors = {};
    if (!name.trim()) found.name = 'Name this add-on';
    else if (name.trim().length > 100) found.name = 'Keep it under 100 characters';
    const p = money(price, false);
    if (p === null || Number.isNaN(p)) found.price = 'Enter a price like 50 or 99.50';
    else if (p >= 100_000) found.price = 'That price is too large';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => (e.target as HTMLElement).querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      await onSave(name.trim(), p as number);
      if (!initial) {
        setName('');
        setPrice('');
      }
    } catch (err) {
      setError(menuError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ad-inline-form" onSubmit={submit} noValidate>
      <TextField label="Add-on name" value={name} maxLength={100} placeholder="e.g. Extra cheese" onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} error={errors.name} />
      <TextField label={`Price (${CURRENCY_SYMBOL})`} inputMode="decimal" value={price} placeholder="50" onChange={(e) => { setPrice(e.target.value); setErrors((x) => ({ ...x, price: undefined })); }} error={errors.price} />
      <div className="ad-actions">
        <Button type="submit" loading={busy} loadingText="Saving…">{initial ? 'Save add-on' : 'Add'}</Button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
      {error && <Alert>{error}</Alert>}
    </form>
  );
}

export function AddOnsCard({ item }: { item: MenuItemDetail }) {
  const { push } = useToast();
  const cache = useMenuCache();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AddOn | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const setAddOns = (fn: (a: AddOn[]) => AddOn[]) => cache.patchDetail(item.id, (d) => ({ ...d, add_ons: fn(d.add_ons) }));

  async function add(name: string, price: number) {
    const saved = await adminMenuApi.createAddOn(item.id, { name, price: price.toFixed(2), is_available: true });
    setAddOns((a) => [...a, saved]);
    push('Add-on added');
  }

  async function save(a: AddOn, name: string, price: number) {
    const saved = await adminMenuApi.updateAddOn(a.id, { name, price: price.toFixed(2) });
    setAddOns((list) => list.map((x) => (x.id === a.id ? { ...x, ...saved } : x)));
    setEditing(null);
    push('Add-on saved');
  }

  async function toggle(a: AddOn, next: boolean) {
    setToggling(a.id);
    setAddOns((list) => list.map((x) => (x.id === a.id ? { ...x, is_available: next } : x)));
    try {
      await adminMenuApi.updateAddOn(a.id, { is_available: next });
    } catch (e) {
      setAddOns((list) => list.map((x) => (x.id === a.id ? { ...x, is_available: !next } : x)));
      push(menuError(e), 'error');
    } finally {
      setToggling(null);
    }
  }

  async function remove(a: AddOn) {
    setBusy(true);
    try {
      await adminMenuApi.deleteAddOn(a.id);
      setAddOns((list) => list.filter((x) => x.id !== a.id));
      push(`${a.name} deleted`);
      setDeleting(null);
    } catch (e) {
      push(menuError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card ad-card-pad" aria-labelledby="ao-title">
      <div>
        <h2 id="ao-title" className="ad-rowhead-title">Add-ons</h2>
        <p className="ad-muted" style={{ margin: '4px 0 0' }}>Extras guests can add for a fixed price, like a side or a dip.</p>
      </div>
      {item.add_ons.length > 0 && (
        <ul className="ad-options" aria-label="Add-ons">
          {item.add_ons.map((a) =>
            editing === a.id ? (
              <li key={a.id}>
                <AddOnForm initial={a} onSave={(n, p) => save(a, n, p)} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={a.id} className={a.is_available ? '' : 'is-off'}>
                <span className="ad-option-name">{a.name}</span>
                <span className="ad-muted">{formatMoney(a.price)}</span>
                <span className="ad-row-tools">
                  <MiniSwitch checked={a.is_available} label={`${a.name} is available`} disabled={toggling === a.id} onChange={(v) => toggle(a, v)} />
                  <button type="button" className="ad-link" aria-label={`Edit add-on ${a.name}`} onClick={() => setEditing(a.id)}>Edit</button>
                  <button type="button" className="ad-link danger" aria-label={`Delete add-on ${a.name}`} onClick={() => setDeleting(a)}>Delete</button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      <AddOnForm onSave={add} />
      {deleting && <ConfirmDialog title={`Delete ${deleting.name}?`} message="Guests will no longer be able to add it to this dish." confirmLabel="Delete add-on" busy={busy} onConfirm={() => remove(deleting)} onClose={() => !busy && setDeleting(null)} />}
    </section>
  );
}
