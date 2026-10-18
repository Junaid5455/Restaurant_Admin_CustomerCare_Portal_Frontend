'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { CheckoutSteps } from './checkout-steps';
import { OrderDetails } from './order-details';
import { OrderSummary } from './order-summary';
import { StripeCardField, type StripeCardHandle } from './stripe-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { ordersApi } from '@/lib/api/orders';
import { isCardResult, paymentsApi, type PayMethod } from '@/lib/api/payments';
import { getSnapshot, saveSnapshot, type CheckoutSnapshot } from '@/lib/checkout-session';
import { ApiError, parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export const confirmationPath = (orderId: string) => `/customer/checkout/confirmation/${orderId}`;

export function PaymentView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const cardRef = useRef<StripeCardHandle>(null);

  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => ordersApi.get(orderId) });

  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const secretRef = useRef<string | null>(null);
  useEffect(() => {
    const snap = getSnapshot(orderId);
    setSnapshot(snap);
    setPaymentId(snap?.paymentId ?? null);
  }, [orderId]);

  const [chosen, setChosen] = useState<PayMethod>('CREDIT_CARD');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const o = order.data;

  // Already paid, confirmed or cancelled: this page has nothing left to do.
  useEffect(() => {
    if (o && (o.payment_status !== 'PENDING' || o.status !== 'PLACED')) {
      setLeaving(true);
      router.replace(confirmationPath(orderId));
    }
  }, [o, orderId, router]);

  if (order.isPending || leaving) {
    return (
      <div aria-busy="true" aria-label="Loading payment">
        <div className="sv-skel" style={{ height: 34, width: 220, marginBottom: 18 }} />
        <div className="sv-cart-layout">
          <div className="sv-skel" style={{ height: 300 }} />
          <div className="sv-skel" style={{ height: 260 }} />
        </div>
      </div>
    );
  }
  if (order.isError || !o) {
    const err = order.error ? parseError(order.error) : null;
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">🔎</div>
        <h2>{err?.status === 404 ? 'We couldn’t find that order' : 'We couldn’t load your order'}</h2>
        <p>{err?.display ?? 'Please try again.'}</p>
        {err?.status === 404 ? (
          <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => order.refetch()}>Try again</button>
        )}
      </div>
    );
  }

  const cashMethod: PayMethod = o.order_type === 'DELIVERY' ? 'CASH_ON_DELIVERY' : 'CASH_AT_RESTAURANT';
  const cashTitle = o.order_type === 'DELIVERY' ? 'Cash on delivery' : o.order_type === 'DINE_IN' ? 'Pay at the table' : 'Pay at the restaurant';
  // The API allows a single payment per order, so once a card payment exists cash can no longer be chosen.
  const cardStarted = paymentId !== null;
  const method: PayMethod = cardStarted ? 'CREDIT_CARD' : chosen;
  const liveStripe = !!STRIPE_KEY;

  async function pay() {
    if (!o) return;
    setPaying(true);
    setError(null);
    try {
      if (method === 'CREDIT_CARD') {
        let id = paymentId;
        if (!id) {
          const res = await paymentsApi.process(orderId, 'CREDIT_CARD');
          if (!isCardResult(res)) throw new ApiError('Unexpected response from the payment service.');
          id = res.payment.id;
          secretRef.current = res.client_secret;
          setPaymentId(id);
          saveSnapshot(orderId, { paymentId: id });
        }
        // Mock-mode backends hand out "mock_…" secrets: there is nothing to charge, so skip the card form.
        const secret = secretRef.current;
        if (liveStripe && secret && !secret.startsWith('mock_')) {
          const message = await cardRef.current?.confirm(secret);
          if (message) throw new ApiError(message);
        }
        await paymentsApi.confirm(id);
      } else {
        await paymentsApi.process(orderId, cashMethod);
      }
      await queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setLeaving(true);
      router.replace(confirmationPath(orderId));
    } catch (e) {
      const err = e instanceof ApiError ? e : parseError(e);
      if (/already paid/i.test(err.display)) {
        setLeaving(true);
        router.replace(confirmationPath(orderId));
        return;
      }
      setError(err.display);
    } finally {
      setPaying(false);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    try {
      await ordersApi.cancel(orderId);
      push('Your order was cancelled.', 'info');
      router.replace('/customer/restaurants');
    } catch (e) {
      setConfirmCancel(false);
      setError(parseError(e).display);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <CheckoutSteps current={2} />

      <div className="sv-page-head" style={{ marginTop: 18 }}>
        <h1>Payment</h1>
        <p>Your order #{o.order_number} is placed. Choose how you’d like to pay {formatMoney(o.total_amount)}.</p>
      </div>

      <div className="sv-cart-layout">
        <div className="sv-checkout-main">
          <section className="card sv-sec" aria-labelledby="pm-h">
            <h2 id="pm-h"><span className="n">1</span> Payment method</h2>
            <div className="sv-types two" role="radiogroup" aria-labelledby="pm-h">
              <label className={`sv-type ${method === 'CREDIT_CARD' ? 'selected' : ''}`}>
                <input type="radio" name="pay" checked={method === 'CREDIT_CARD'} onChange={() => setChosen('CREDIT_CARD')} />
                <span className="icon" aria-hidden="true">💳</span>
                <span className="title">Card</span>
                <span className="desc">Pay securely online</span>
              </label>
              <label className={`sv-type ${method === cashMethod ? 'selected' : ''} ${cardStarted ? 'off' : ''}`}>
                <input type="radio" name="pay" checked={method === cashMethod} disabled={cardStarted} onChange={() => setChosen(cashMethod)} />
                <span className="icon" aria-hidden="true">💵</span>
                <span className="title">{cashTitle}</span>
                <span className="desc">{cardStarted ? 'Unavailable after starting a card payment' : 'Pay in cash'}</span>
              </label>
            </div>

            {method === 'CREDIT_CARD' && (
              <div className="sv-card-box">
                {liveStripe ? (
                  <>
                    <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>Card details</label>
                    <StripeCardField publishableKey={STRIPE_KEY} handleRef={cardRef} disabled={paying} />
                    <p className="field-hint" style={{ marginTop: 8 }}>Your card details go straight to Stripe. Savoria never sees them.</p>
                  </>
                ) : (
                  <Alert kind="info">
                    Test mode: no card form is shown and nothing is charged. Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to take real card payments.
                  </Alert>
                )}
              </div>
            )}

            {method !== 'CREDIT_CARD' && (
              <p className="sv-pay-note">
                {o.order_type === 'DELIVERY'
                  ? 'Pay the driver in cash when your order arrives.'
                  : 'Pay in cash when you collect your order.'}{' '}
                The restaurant starts on it right away.
              </p>
            )}
          </section>

          {error && <Alert>{error}</Alert>}

          <div className="sv-pay-actions">
            <Button loading={paying} loadingText={method === 'CREDIT_CARD' ? 'Processing payment…' : 'Confirming…'} onClick={pay}>
              {method === 'CREDIT_CARD' ? `Pay ${formatMoney(o.total_amount)}` : 'Confirm order'}
            </Button>
            <button type="button" className="sv-link-btn" disabled={paying} onClick={() => setConfirmCancel(true)}>
              Cancel this order
            </button>
          </div>
        </div>

        <aside className="sv-cart-aside">
          <OrderSummary subtotal={o.subtotal} tax={o.tax_amount} deliveryFee={o.delivery_fee} total={o.total_amount}>
            <OrderDetails order={o} snapshot={snapshot} />
          </OrderSummary>
        </aside>
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel this order?"
          message="The restaurant will be told you no longer want it. You can order again any time."
          confirmLabel="Cancel order"
          busy={cancelling}
          onConfirm={cancelOrder}
          onClose={() => !cancelling && setConfirmCancel(false)}
        />
      )}
    </div>
  );
}
