'use client';

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';

/* Minimal typings for Stripe.js, which is loaded from js.stripe.com at runtime (no npm package needed). */
interface StripeCardElement {
  mount(el: HTMLElement): void;
  destroy(): void;
  on(event: 'change', cb: (e: { error?: { message?: string }; complete: boolean }) => void): void;
}
interface StripeInstance {
  elements(): { create(type: 'card', options?: Record<string, unknown>): StripeCardElement };
  confirmCardPayment(
    secret: string,
    data: { payment_method: { card: StripeCardElement; billing_details?: BillingDetails } },
  ): Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
}
interface BillingDetails {
  name: string;
  address?: { line1?: string; city?: string; state?: string; country?: string };
}

/** ISO 3166 country codes (Stripe wants the 2-letter code); names come from the browser. */
const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
function countryOptions(): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser: show the codes */ }
  return COUNTRY_CODES.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

let stripeScript: Promise<void> | null = null;
function loadStripeJs(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  stripeScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      stripeScript = null;
      reject(new Error('Could not load the secure card form.'));
    };
    document.head.appendChild(s);
  });
  return stripeScript;
}

export interface StripeCardHandle {
  /** Confirms the PaymentIntent with the typed card. Resolves to an error message, or null on success. */
  confirm(clientSecret: string): Promise<string | null>;
}

export function StripeCardField({
  publishableKey,
  handleRef,
  disabled,
  defaultName = '',
}: {
  publishableKey: string;
  handleRef: Ref<StripeCardHandle>;
  disabled?: boolean;
  /** Pre-filled "name on card" (the guest can change it). */
  defaultName?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [billing, setBilling] = useState({ line1: '', city: '', state: '', country: '' });
  const countries = useMemo(countryOptions, []);
  const billingRef = useRef({ name: defaultName, ...billing });
  billingRef.current = { name, ...billing };
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<StripeInstance | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStripeJs()
      .then(() => {
        if (cancelled || !mountRef.current || !window.Stripe) return;
        const css = getComputedStyle(document.documentElement);
        const stripe = window.Stripe(publishableKey);
        const card = stripe.elements().create('card', {
          style: {
            base: {
              color: css.getPropertyValue('--fg').trim() || '#1a1030',
              fontSize: '15px',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              '::placeholder': { color: css.getPropertyValue('--fg-3').trim() || '#9080b0' },
            },
            invalid: { color: css.getPropertyValue('--crit').trim() || '#d93030' },
          },
        });
        card.mount(mountRef.current);
        card.on('change', (e) => setCardError(e.error?.message ?? null));
        stripeRef.current = stripe;
        cardRef.current = card;
        setReady(true);
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [publishableKey]);

  useImperativeHandle(
    handleRef,
    () => ({
      async confirm(clientSecret: string) {
        if (!stripeRef.current || !cardRef.current) return 'The card form is still loading. Please wait a moment.';
        const b = billingRef.current;
        if (!b.name.trim()) {
          setNameError('Enter the name on the card');
          return 'Enter the name on the card.';
        }
        const address = Object.fromEntries(Object.entries({ line1: b.line1.trim(), city: b.city.trim(), state: b.state.trim(), country: b.country }).filter(([, v]) => v));
        const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
          payment_method: { card: cardRef.current, billing_details: { name: b.name.trim(), ...(Object.keys(address).length ? { address } : {}) } },
        });
        if (error) return error.message ?? 'Your card was declined.';
        return paymentIntent?.status === 'succeeded' ? null : 'The payment is not complete yet. Please try again.';
      },
    }),
    [],
  );

  const set = (key: keyof typeof billing) => (e: { target: { value: string } }) => setBilling((v) => ({ ...v, [key]: e.target.value }));

  return (
    <div>
      <label className="field-label" htmlFor="card-name" style={{ display: 'block', marginBottom: 6 }}>Name on card</label>
      <input
        id="card-name"
        className="input sv-card-input"
        type="text"
        autoComplete="cc-name"
        placeholder="As printed on the card"
        maxLength={80}
        value={name}
        disabled={disabled}
        aria-invalid={nameError ? true : undefined}
        onChange={(e) => { setName(e.target.value); setNameError(null); }}
      />
      {nameError && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{nameError}</p>}

      <label className="field-label" style={{ display: 'block', margin: '14px 0 6px' }}>Card details</label>
      <div className={`sv-stripe ${disabled ? 'disabled' : ''}`} aria-busy={!ready && !loadError}>
        <div ref={mountRef} />
        {!ready && !loadError && <span className="sv-stripe-loading">Loading secure card form…</span>}
      </div>
      {(loadError || cardError) && (
        <p className="field-error" role="alert" style={{ marginTop: 6 }}>{loadError ?? cardError}</p>
      )}

      <details className="sv-billing">
        <summary>Billing address <span className="opt">(optional)</span></summary>
        <p className="field-hint" style={{ margin: '6px 0 10px' }}>Only needed if your bank asks for it. The postal code is taken from the card box above.</p>
        <div className="sv-billing-grid">
          <input className="input sv-card-input" aria-label="Billing street address" autoComplete="billing street-address" placeholder="Street address" maxLength={120} value={billing.line1} disabled={disabled} onChange={set('line1')} />
          <input className="input sv-card-input" aria-label="Billing city" autoComplete="billing address-level2" placeholder="City" maxLength={60} value={billing.city} disabled={disabled} onChange={set('city')} />
          <input className="input sv-card-input" aria-label="Billing state or province" autoComplete="billing address-level1" placeholder="State / province" maxLength={60} value={billing.state} disabled={disabled} onChange={set('state')} />
          <select className="input sv-card-input" aria-label="Billing country" autoComplete="billing country" value={billing.country} disabled={disabled} onChange={set('country')}>
            <option value="">Country</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </details>
    </div>
  );
}
