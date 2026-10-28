'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AddOnsCard, CustomizationsCard } from './customization-builder';
import { ImageField } from './menu-kit';
import { mapSaveError, SaveBar } from './settings-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextArea } from '@/components/ui/text-area';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { menuError, useMenu, useMenuCache, useMenuItem } from '@/hooks/use-admin-menu';
import { useUnsavedWarning } from '@/hooks/use-restaurant-settings';
import { adminMenuApi, type ItemInput, type MenuCategory, type MenuItemDetail } from '@/lib/api/admin-menu';
import { CURRENCY_SYMBOL } from '@/lib/constants';
import { ApiError, parseError } from '@/lib/errors';
import { toNumber } from '@/lib/format';

interface Values {
  name: string;
  description: string;
  price: string;
  category: string;
  prep: string;
  calories: string;
  available: boolean;
  featured: boolean;
  isNew: boolean;
  vegetarian: boolean;
  vegan: boolean;
  spicy: boolean;
}

type Errors = Partial<Record<'name' | 'description' | 'price' | 'category' | 'prep' | 'calories', string>>;
const FIELD_ORDER = ['name', 'description', 'price', 'category', 'prep', 'calories'] as const;

const fromDetail = (d: MenuItemDetail): Values => ({
  name: d.name,
  description: d.description ?? '',
  price: String(toNumber(d.price)),
  category: d.category?.id ?? '',
  prep: String(d.prep_time ?? 15),
  calories: d.calories == null ? '' : String(d.calories),
  available: d.is_available,
  featured: d.is_featured,
  isNew: d.is_new,
  vegetarian: d.is_vegetarian,
  vegan: d.is_vegan,
  spicy: d.is_spicy,
});

const EMPTY: Values = { name: '', description: '', price: '', category: '', prep: '15', calories: '', available: true, featured: false, isNew: false, vegetarian: false, vegan: false, spicy: false };

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = 'Give this dish a name';
  else if (v.name.trim().length > 200) e.name = 'Keep the name under 200 characters';
  if (!v.description.trim()) e.description = 'Add a short description for guests';
  else if (v.description.trim().length > 2000) e.description = 'Keep the description under 2,000 characters';
  const price = v.price.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(price)) e.price = 'Enter a price like 450 or 99.50';
  else if (Number(price) >= 1_000_000) e.price = 'That price is too large';
  if (!v.category) e.category = 'Choose a category';
  if (!/^\d+$/.test(v.prep.trim()) || Number(v.prep) < 1 || Number(v.prep) > 240) e.prep = 'Enter whole minutes between 1 and 240';
  if (v.calories.trim() !== '' && (!/^\d+$/.test(v.calories.trim()) || Number(v.calories) > 10000)) e.calories = 'Enter whole calories, up to 10,000';
  return e;
}

/** Fields the stock MenuItemSerializer doesn't accept: they are checked after saving. */
const UNSTABLE: { key: keyof Values; label: string; read: (d: MenuItemDetail) => unknown; mine: (v: Values) => unknown }[] = [
  { key: 'prep', label: 'preparation time', read: (d) => d.prep_time, mine: (v) => Number(v.prep) },
  { key: 'calories', label: 'calories', read: (d) => d.calories, mine: (v) => (v.calories.trim() === '' ? null : Number(v.calories)) },
  { key: 'vegetarian', label: 'vegetarian', read: (d) => d.is_vegetarian, mine: (v) => v.vegetarian },
  { key: 'vegan', label: 'vegan', read: (d) => d.is_vegan, mine: (v) => v.vegan },
  { key: 'spicy', label: 'spicy', read: (d) => d.is_spicy, mine: (v) => v.spicy },
];

function Editor({ item, categories }: { item: MenuItemDetail | null; categories: MenuCategory[] }) {
  const router = useRouter();
  const { push } = useToast();
  const cache = useMenuCache();
  const baseline = item ? fromDetail(item) : EMPTY;
  const [v, setV] = useState<Values>(baseline);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const dirty = !!file || (Object.keys(baseline) as (keyof Values)[]).some((k) => v[k] !== baseline[k]);
  useUnsavedWarning(dirty && !busy);

  const set = <K extends keyof Values>(k: K, value: Values[K]) => {
    setV((x) => ({ ...x, [k]: value }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const text = (k: keyof Values & ('name' | 'description' | 'price' | 'prep' | 'calories')) => (e: { target: { value: string } }) => set(k, e.target.value);

  function toInput(values: Values): ItemInput {
    return {
      name: values.name.trim(),
      description: values.description.trim(),
      price: Number(values.price).toFixed(2),
      category_id: values.category,
      is_available: values.available,
      is_featured: values.featured,
      is_new: values.isNew,
      prep_time: Number(values.prep),
      calories: values.calories.trim() === '' ? null : Number(values.calories),
      is_spicy: values.spicy,
      is_vegetarian: values.vegetarian || values.vegan,
      is_vegan: values.vegan,
    };
  }

  /** After a save, re-read the dish and say so if the server dropped any of the fields it doesn't accept. */
  async function checkStored(id: string, sent: Values, changed: (keyof Values)[]) {
    const touched = UNSTABLE.filter((u) => changed.includes(u.key));
    if (!touched.length) return;
    const stored = await adminMenuApi.getItem(id);
    const ignored = touched.filter((u) => u.read(stored) !== u.mine(sent)).map((u) => u.label);
    if (ignored.length) push(`Saved, but the server didn't keep: ${ignored.join(', ')}. See the backend notes for step 7.4.`, 'info');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(v);
    setErrors(found);
    if (FIELD_ORDER.some((f) => found[f])) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const input = toInput(v);
    setBusy(true);
    try {
      if (!item) {
        const created = await adminMenuApi.createItem(input, file);
        await checkStored(created.id, v, ['prep', 'calories', 'vegetarian', 'vegan', 'spicy'].filter((k) => v[k as keyof Values] !== EMPTY[k as keyof Values]) as (keyof Values)[]).catch(() => {});
        await cache.refresh();
        push('Dish added. Now add customizations or add-ons if it needs them.');
        router.replace(`/owner/menu/items/${created.id}`);
        return;
      }
      const patch: Partial<ItemInput> = {};
      const b = baseline;
      if (v.name.trim() !== b.name) patch.name = input.name;
      if (v.description.trim() !== b.description) patch.description = input.description;
      if (Number(v.price) !== Number(b.price)) patch.price = input.price;
      if (v.category !== b.category) patch.category_id = input.category_id;
      if (v.available !== b.available) patch.is_available = v.available;
      if (v.featured !== b.featured) patch.is_featured = v.featured;
      if (v.isNew !== b.isNew) patch.is_new = v.isNew;
      const changed: (keyof Values)[] = [];
      if (v.prep !== b.prep) { patch.prep_time = input.prep_time; changed.push('prep'); }
      if (v.calories !== b.calories) { patch.calories = input.calories; changed.push('calories'); }
      if (v.vegetarian !== b.vegetarian || v.vegan !== b.vegan) { patch.is_vegetarian = input.is_vegetarian; patch.is_vegan = input.is_vegan; changed.push('vegetarian', 'vegan'); }
      if (v.spicy !== b.spicy) { patch.is_spicy = input.is_spicy; changed.push('spicy'); }
      if (Object.keys(patch).length) await adminMenuApi.updateItem(item.id, patch);
      if (file) await adminMenuApi.uploadItemImage(item.id, file);
      await checkStored(item.id, { ...v, vegetarian: v.vegetarian || v.vegan }, changed).catch(() => {});
      await cache.refresh(item.id);
      setFile(null);
      push('Dish saved');
    } catch (err) {
      const m = mapSaveError(err, ['name', 'description', 'price', 'category_id']);
      setErrors({ name: m.fields.name, description: m.fields.description, price: m.fields.price, category: m.fields.category_id });
      setFormError(m.form ? menuError(err) : null);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    setDeleteBusy(true);
    try {
      await adminMenuApi.deleteItem(item.id);
      await cache.refresh();
      push(`${item.name} deleted`);
      router.replace('/owner/menu');
    } catch (e) {
      push(menuError(e), 'error');
      setDeleteBusy(false);
    }
  }

  const noCategories = categories.length === 0;

  return (
    <>
      <Link href="/owner/menu" className="ad-back">← All items</Link>
      <div className="ad-head">
        <div>
          <h1>{item ? item.name : 'Add a dish'}</h1>
          <p>{item ? 'Edit the dish, its picture, customizations and add-ons.' : 'Fill in the basics. You can add customizations and add-ons right after.'}</p>
        </div>
        {item && (
          <div className="ad-head-actions">
            <button type="button" className="ad-link danger" onClick={() => setDeleting(true)}>Delete dish</button>
          </div>
        )}
      </div>

      <div className="ad-stack">
        {noCategories && (
          <Alert kind="info">
            You need a category first. <Link href="/owner/menu/categories" className="ad-rowlink" style={{ textDecoration: 'underline' }}>Create one</Link>, then come back.
          </Alert>
        )}
        <form onSubmit={submit} noValidate className="ad-stack">
          <section className="card ad-card-pad" aria-labelledby="mi-basic">
            <h2 id="mi-basic" className="ad-rowhead-title">Basics</h2>
            <TextField label="Name" value={v.name} maxLength={200} onChange={text('name')} error={errors.name} />
            <TextArea label="Description" rows={3} maxLength={2000} value={v.description} onChange={text('description')} error={errors.description} hint="What guests read before they order." />
            <div className="ad-three">
              <TextField label={`Price (${CURRENCY_SYMBOL})`} inputMode="decimal" value={v.price} onChange={text('price')} error={errors.price} />
              <div className="field">
                <label className="field-label" htmlFor="mi-category">Category</label>
                <select id="mi-category" className={`ad-select ${errors.category ? 'invalid' : ''}`} style={{ width: '100%' }} value={v.category} onChange={(e) => set('category', e.target.value)} aria-invalid={errors.category ? true : undefined} disabled={noCategories}>
                  <option value="">Choose…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.category && <p className="field-error" role="alert">{errors.category}</p>}
              </div>
              <TextField label="Prep time (minutes)" inputMode="numeric" value={v.prep} onChange={text('prep')} error={errors.prep} />
            </div>
          </section>

          <section className="card ad-card-pad" aria-labelledby="mi-pic">
            <h2 id="mi-pic" className="ad-rowhead-title">Picture</h2>
            {item ? (
              <ImageField
                label="Dish picture"
                hint="Square pictures look best. JPG, PNG, WebP or GIF, up to 5 MB."
                name={item.name}
                src={item.image}
                onUpload={async (f) => { try { await adminMenuApi.uploadItemImage(item.id, f); await cache.refresh(item.id); push('Picture updated'); } catch (e) { throw new Error(menuError(e)); } }}
                onRemove={async () => { try { await adminMenuApi.removeItemImage(item.id); await cache.refresh(item.id); push('Picture removed'); } catch (e) { throw new Error(menuError(e)); } }}
              />
            ) : (
              <ImageField label="Dish picture" hint="Optional. It is uploaded when you add the dish." name={v.name} src={null} onPick={setFile} />
            )}
          </section>

          <section className="card ad-card-pad" aria-labelledby="mi-flags">
            <h2 id="mi-flags" className="ad-rowhead-title">Availability &amp; labels</h2>
            <Switch label="Available to order" description="Turn off when you've run out. The dish stays on your menu but guests can't order it." checked={v.available} onChange={(x) => set('available', x)} />
            <Switch label="Featured" description="Highlight this dish to guests." checked={v.featured} onChange={(x) => set('featured', x)} />
            <Switch label="Mark as new" description="Shows a New badge." checked={v.isNew} onChange={(x) => set('isNew', x)} />
            <fieldset className="ad-tags">
              <legend className="field-label">Dietary tags</legend>
              <label className="ad-check"><input type="checkbox" checked={v.vegetarian || v.vegan} disabled={v.vegan} onChange={(e) => set('vegetarian', e.target.checked)} /> Vegetarian</label>
              <label className="ad-check"><input type="checkbox" checked={v.vegan} onChange={(e) => { set('vegan', e.target.checked); if (e.target.checked) set('vegetarian', true); }} /> Vegan</label>
              <label className="ad-check"><input type="checkbox" checked={v.spicy} onChange={(e) => set('spicy', e.target.checked)} /> Spicy</label>
            </fieldset>
            <TextField label="Calories" optional inputMode="numeric" value={v.calories} onChange={text('calories')} error={errors.calories} />
          </section>

          <SaveBar dirty={dirty} busy={busy} error={formError} saveLabel={item ? 'Save changes' : 'Add dish'} onDiscard={() => { setV(baseline); setFile(null); setErrors({}); setFormError(null); }} />
        </form>

        {item ? (
          <>
            <CustomizationsCard item={item} />
            <AddOnsCard item={item} />
          </>
        ) : (
          <p className="ad-muted">Customizations and add-ons appear here once the dish is added.</p>
        )}
      </div>

      {deleting && item && (
        <ConfirmDialog title={`Delete ${item.name}?`} message="It disappears from your menu. Past orders keep the name and price. This can't be undone." confirmLabel="Delete dish" busy={deleteBusy} onConfirm={remove} onClose={() => !deleteBusy && setDeleting(false)} />
      )}
    </>
  );
}

export function MenuItemEditorView({ id }: { id: string | null }) {
  const menu = useMenu();
  const detail = useMenuItem(id);

  if (menu.isPending || (id && detail.isPending)) {
    return (
      <div aria-busy="true" aria-label="Loading dish">
        <div className="ad-skel" style={{ height: 70, borderRadius: 16, marginBottom: 16 }} />
        <div className="ad-skel" style={{ height: 320, borderRadius: 16 }} />
      </div>
    );
  }
  const failed = menu.isError ? menu : id && detail.isError ? detail : null;
  if (failed) {
    const err = parseError(failed.error);
    const missing = err instanceof ApiError && err.status === 404;
    return (
      <div className="card ad-empty" role="alert">
        <div className="ad-empty-icon" aria-hidden="true">{missing ? '🔍' : '⚠️'}</div>
        <strong>{missing ? 'We can’t find that dish' : 'We couldn’t load this dish'}</strong>
        <span>{missing ? 'It may have been deleted, or it belongs to another restaurant.' : err.display}</span>
        {missing ? <Link href="/owner/menu" className="btn btn-primary">Back to the menu</Link> : <Button onClick={() => { void menu.refetch(); void detail.refetch(); }}>Try again</Button>}
      </div>
    );
  }
  // Remount the form when the dish id changes (after creating a dish).
  return <Editor key={id ?? 'new'} item={id ? (detail.data as MenuItemDetail) : null} categories={menu.data?.categories ?? []} />;
}
