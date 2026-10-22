'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryGate, SaveBar, SettingsFrame, mapSaveError } from './settings-kit';
import { SafeImage } from '@/components/ui/safe-image';
import { TextArea } from '@/components/ui/text-area';
import { TextField } from '@/components/ui/text-field';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { SETTINGS_KEY, useRestaurantSettings, useSaveSettings, useUnsavedWarning } from '@/hooks/use-restaurant-settings';
import { restaurantSettingsApi, type RestaurantSettings } from '@/lib/api/restaurant-settings';
import { parseError } from '@/lib/errors';
import { initials, mediaUrl } from '@/lib/format';

const FIELDS = ['name', 'description', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code'] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;

const MAX: Record<Field, number> = { name: 200, description: 2000, email: 254, phone: 15, address: 500, city: 100, state: 100, country: 100, postal_code: 10 };
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const fromSettings = (s: RestaurantSettings): Values => ({
  name: s.name ?? '', description: s.description ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '',
  city: s.city ?? '', state: s.state ?? '', country: s.country ?? '', postal_code: s.postal_code ?? '',
});

function validate(v: Values): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  const need = (f: Field, label: string) => { if (!v[f].trim()) e[f] = `Enter ${label}`; else if (v[f].length > MAX[f]) e[f] = `Keep this under ${MAX[f]} characters`; };
  need('name', 'your restaurant name');
  need('address', 'the street address');
  need('city', 'the city');
  need('state', 'the state or province');
  need('country', 'the country');
  need('postal_code', 'the postal code');
  if (!v.email.trim()) e.email = 'Enter a contact email';
  else if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email address';
  if (!v.phone.trim()) e.phone = 'Enter a contact phone number';
  else if (v.phone.trim().length > MAX.phone) e.phone = `Phone numbers can be up to ${MAX.phone} characters`;
  if (v.description.length > MAX.description) e.description = `Keep this under ${MAX.description} characters`;
  return e;
}

function ImageCard({ field, title, hint, src, name, shape }: { field: 'logo' | 'banner'; title: string; hint: string; src: string | null; name: string; shape: 'square' | 'wide' }) {
  const qc = useQueryClient();
  const { push } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setError('Use a JPG, PNG, WebP or GIF image.');
    if (file.size > MAX_IMAGE) return setError('That image is over 5 MB. Choose a smaller one.');
    setBusy(true);
    try {
      const saved = await restaurantSettingsApi.uploadImage(field, file);
      qc.setQueryData(SETTINGS_KEY, saved);
      push(`${title} updated`);
    } catch (err) {
      setError(parseError(err).display);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ad-image">
      <div className={`ad-image-preview ${shape}`} aria-hidden="true">
        <SafeImage src={mediaUrl(src)} alt="" fallback={<span>{initials(name) || '🍽'}</span>} />
      </div>
      <div className="ad-image-side">
        <div className="ad-setting-label">{title}</div>
        <p className="ad-setting-desc">{hint}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={pick} aria-label={`Choose a new ${title.toLowerCase()}`} />
        <Button type="button" variant="ghost" loading={busy} loadingText="Uploading…" onClick={() => input.current?.click()}>
          {src ? 'Replace image' : 'Upload image'}
        </Button>
      </div>
    </div>
  );
}

function DetailsForm({ s }: { s: RestaurantSettings }) {
  const { push } = useToast();
  const save = useSaveSettings();
  const baseline = fromSettings(s);
  const [values, setValues] = useState<Values>(baseline);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const dirty = FIELDS.some((f) => values[f] !== baseline[f]);
  useUnsavedWarning(dirty);

  const set = (f: Field) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [f]: e.target.value }));
    setErrors((x) => ({ ...x, [f]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(values);
    setErrors(found);
    const first = FIELDS.find((f) => found[f]);
    if (first) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    // Send only what changed.
    const patch: Record<string, string | null> = {};
    for (const f of FIELDS) if (values[f] !== baseline[f]) patch[f] = f === 'description' ? values[f].trim() || null : values[f].trim();
    try {
      await save.mutateAsync(patch);
      push('Restaurant details saved');
    } catch (err) {
      const m = mapSaveError(err, [...FIELDS]);
      setErrors(m.fields);
      setFormError(m.form);
      if (Object.keys(m.fields).length) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    }
  }

  return (
    <>
      <section className="card ad-card-pad" aria-labelledby="rd-photos">
        <h2 id="rd-photos" className="ad-card-title">Photos</h2>
        <p className="ad-note">Photos upload as soon as you choose them.</p>
        <ImageCard field="logo" title="Logo" hint="Shown on restaurant cards and your menu. Square works best." src={s.logo} name={s.name} shape="square" />
        <ImageCard field="banner" title="Banner" hint="The wide image at the top of your restaurant page." src={s.banner} name={s.name} shape="wide" />
      </section>

      <form onSubmit={submit} noValidate className="ad-stack">
        <section className="card ad-card-pad" aria-labelledby="rd-about">
          <h2 id="rd-about" className="ad-card-title">About your restaurant</h2>
          <TextField label="Restaurant name" value={values.name} onChange={set('name')} error={errors.name} maxLength={MAX.name} autoComplete="organization" />
          <TextArea label="Description" value={values.description} onChange={set('description')} error={errors.description} maxLength={MAX.description} counter rows={4}
            hint="A short welcome guests read before they order." />
        </section>

        <section className="card ad-card-pad" aria-labelledby="rd-contact">
          <h2 id="rd-contact" className="ad-card-title">Contact</h2>
          <div className="ad-two">
            <TextField label="Contact email" type="email" inputMode="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            <TextField label="Phone" type="tel" inputMode="tel" value={values.phone} onChange={set('phone')} error={errors.phone} maxLength={MAX.phone} autoComplete="tel" hint="Up to 15 characters" />
          </div>
        </section>

        <section className="card ad-card-pad" aria-labelledby="rd-where">
          <h2 id="rd-where" className="ad-card-title">Address</h2>
          <TextField label="Street address" value={values.address} onChange={set('address')} error={errors.address} autoComplete="street-address" />
          <div className="ad-two">
            <TextField label="City" value={values.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
            <TextField label="State / province" value={values.state} onChange={set('state')} error={errors.state} autoComplete="address-level1" />
          </div>
          <div className="ad-two">
            <TextField label="Country" value={values.country} onChange={set('country')} error={errors.country} autoComplete="country-name" />
            <TextField label="Postal code" value={values.postal_code} onChange={set('postal_code')} error={errors.postal_code} maxLength={MAX.postal_code} autoComplete="postal-code" />
          </div>
        </section>

        <SaveBar dirty={dirty} busy={save.isPending} error={formError} onDiscard={() => { setValues(baseline); setErrors({}); setFormError(null); }} />
      </form>
    </>
  );
}

export function RestaurantDetailsView() {
  const q = useRestaurantSettings();
  return (
    <SettingsFrame active="details">
      <QueryGate query={q}>{(s) => <DetailsForm s={s} />}</QueryGate>
    </SettingsFrame>
  );
}
