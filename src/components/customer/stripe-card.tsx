'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

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
    data: { payment_method: { card: StripeCardElement } },
  ): Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
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
}: {
  publishableKey: string;
  handleRef: Ref<StripeCardHandle>;
  disabled?: boolean;
}) {
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
        const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(clientSecret, {
          payment_method: { card: cardRef.current },
        });
        if (error) return error.message ?? 'Your card was declined.';
        return paymentIntent?.status === 'succeeded' ? null : 'The payment is not complete yet. Please try again.';
      },
    }),
    [],
  );

  return (
    <div>
      <div className={`sv-stripe ${disabled ? 'disabled' : ''}`} aria-busy={!ready && !loadError}>
        <div ref={mountRef} />
        {!ready && !loadError && <span className="sv-stripe-loading">Loading secure card form…</span>}
      </div>
      {(loadError || cardError) && (
        <p className="field-error" role="alert" style={{ marginTop: 6 }}>{loadError ?? cardError}</p>
      )}
    </div>
  );
}
