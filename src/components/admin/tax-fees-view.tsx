'use client';

import { useState, type FormEvent } from 'react';
import { QueryGate, SaveBar, SettingsFrame, mapSaveError } from './settings-kit';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useRestaurantSettings, useSaveSettings, useUnsavedWarning } from '@/hooks/use-restaurant-settings';
import type { RestaurantSettings } from '@/lib/api/restaurant-settings';
import { CURRENCY_SYMBOL } from '@/lib/constants';
import { formatMoney, toNumber } from '@/lib/format';

type Key = 'tax' | 'delivery' | 'min';

/** Plain decimal text → number, or null when it isn't a valid non-negative amount. */
function amount(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

const fmtField = (s: string) => String(toNumber(s));

function FeesForm({ s }: { s: RestaurantSettings }) {
  const { push } = useToast();
  const save = useSaveSettings();
  const base = { tax: fmtField(s.tax_rate), delivery: fmtField(s.delivery_fee), min: fmtField(s.min_order_amount) };
  const [v, setV] = useState(base);
  const [sample, setSample] = useState('1000');
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = v.tax !== base.tax || v.delivery !== base.delivery || v.min !== base.min;
  useUnsavedWarning(dirty);

  const set = (k: Key) => (e: { target: { value: string } }) => { setV((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    const tax = amount(v.tax), del = amount(v.delivery), min = amount(v.min);
    if (tax === null) found.tax = 'Enter a percentage like 5 or 16.5 (up to 2 decimals)';
    else if (tax > 100) found.tax = 'Tax can’t be more than 100%';
    if (del === null) found.delivery = 'Enter an amount like 150 or 99.50';
    else if (del >= 1_000_000) found.delivery = 'That amount is too large';
    if (min === null) found.min = 'Enter an amount like 500, or 0 for no minimum';
    else if (min >= 1_000_000) found.min = 'That amount is too large';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const patch: Record<string, string> = {};
    if (v.tax !== base.tax) patch.tax_rate = tax!.toFixed(2);
    if (v.delivery !== base.delivery) patch.delivery_fee = del!.toFixed(2);
    if (v.min !== base.min) patch.min_order_amount = min!.toFixed(2);
    try {
      await save.mutateAsync(patch);
      push('Tax and fees saved');
    } catch (err) {
      const m = mapSaveError(err, ['tax_rate', 'delivery_fee', 'min_order_amount']);
      setErrors({ tax: m.fields.tax_rate, delivery: m.fields.delivery_fee, min: m.fields.min_order_amount });
      setFormError(m.form);
    }
  }

  // Live example, using the values being typed, with the same maths the server uses for an order total.
  const sub = amount(sample);
  const taxPct = amount(v.tax), delFee = amount(v.delivery), minAmt = amount(v.min);
  const ready = sub !== null && taxPct !== null && delFee !== null;
  const taxAmt = ready ? sub * (taxPct / 100) : 0;
  const pickupTotal = ready ? sub + taxAmt : 0;
  const deliveryTotal = ready ? pickupTotal + delFee : 0;

  return (
    <form onSubmit={submit} noValidate className="ad-stack">
      <section className="card ad-card-pad" aria-labelledby="tf-rates">
        <h2 id="tf-rates" className="ad-card-title">Tax and fees</h2>
        <div className="ad-three">
          <TextField label="Tax rate (%)" inputMode="decimal" value={v.tax} onChange={set('tax')} error={errors.tax} hint="Added to every order’s subtotal." />
          <TextField label={`Delivery fee (${CURRENCY_SYMBOL})`} inputMode="decimal" value={v.delivery} onChange={set('delivery')} error={errors.delivery} hint="Charged on delivery orders only." />
          <TextField label={`Minimum order (${CURRENCY_SYMBOL})`} inputMode="decimal" value={v.min} onChange={set('min')} error={errors.min} hint="Use 0 for no minimum." />
        </div>
      </section>

      <section className="card ad-card-pad" aria-labelledby="tf-example">
        <h2 id="tf-example" className="ad-card-title">What a guest pays</h2>
        <TextField label={`Example order subtotal (${CURRENCY_SYMBOL})`} inputMode="decimal" value={sample} onChange={(e) => setSample(e.target.value)} style={{ maxWidth: 240 }} />
        {ready ? (
          <div className="ad-example" role="status" aria-live="polite">
            <table className="ad-calc">
              <thead>
                <tr><th scope="col"><span className="sr-only">Line</span></th><th scope="col" className="num">Pickup / dine-in</th><th scope="col" className="num">Delivery</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Subtotal</th><td className="num">{formatMoney(sub)}</td><td className="num">{formatMoney(sub)}</td></tr>
                <tr><th scope="row">Tax ({taxPct}%)</th><td className="num">{formatMoney(taxAmt)}</td><td className="num">{formatMoney(taxAmt)}</td></tr>
                <tr><th scope="row">Delivery fee</th><td className="num">—</td><td className="num">{formatMoney(delFee)}</td></tr>
                <tr className="total"><th scope="row">Total</th><td className="num">{formatMoney(pickupTotal)}</td><td className="num">{formatMoney(deliveryTotal)}</td></tr>
              </tbody>
            </table>
            {minAmt !== null && minAmt > 0 && sub < minAmt && (
              <p className="ad-warn">This example is below your {formatMoney(minAmt)} minimum, so guests couldn&apos;t place it.</p>
            )}
          </div>
        ) : (
          <p className="ad-note">Enter valid amounts above to see an example.</p>
        )}
      </section>

      <SaveBar dirty={dirty} busy={save.isPending} error={formError} onDiscard={() => { setV(base); setErrors({}); setFormError(null); }} />
    </form>
  );
}

export function TaxFeesView() {
  const q = useRestaurantSettings();
  return (
    <SettingsFrame active="fees">
      <QueryGate query={q}>{(s) => <FeesForm s={s} />}</QueryGate>
    </SettingsFrame>
  );
}
