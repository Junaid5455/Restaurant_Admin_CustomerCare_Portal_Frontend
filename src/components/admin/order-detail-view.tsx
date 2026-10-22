'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { PayBadge } from './orders-kit';
import { RefundModal } from './refund-modal';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { useAdminOrder, useCancelOrder, useUpdateStatus } from '@/hooks/use-admin-orders';
import { useNow } from '@/hooks/use-now';
import type { AdminOrder } from '@/lib/api/admin-orders';
import type { OrderStatus } from '@/lib/api/orders';
import { ACTION_LABEL, canRefund, customerLabel, flow, needsRefund, nextStatus, ownerCanCancel, paymentMethodLabel, previousStatus } from '@/lib/admin-orders';
import { ApiError, parseError } from '@/lib/errors';
import { formatMoney, formatModifier, toNumber } from '@/lib/format';
import { STATUS_LABEL, TYPE_ICON, TYPE_LABEL, isCancelled, isFinished, needsPayment, statusBadgeClass } from '@/lib/order-status';
import { timeAgo } from '@/lib/time-ago';

function when(iso?: string | null): string {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ad-kv">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CancelModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const { push } = useToast();
  const cancel = useCancelOrder();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const paid = order.payment_status === 'COMPLETED';

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!reason.trim()) return setError('Tell the guest why (it is saved on the order)');
    if (reason.trim().length > 200) return setError('Keep the reason under 200 characters');
    cancel.mutate(
      { order, reason: reason.trim() },
      {
        onSuccess: () => {
          push(`Order #${order.order_number} cancelled`);
          onClose();
        },
        onError: (err) => setFormError(parseError(err).display),
      },
    );
  }

  return (
    <Modal onClose={() => !cancel.isPending && onClose()} labelledBy="cancel-title" size="sm">
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-body" style={{ paddingTop: 26 }}>
          <h2 id="cancel-title" className="sv-modal-title" style={{ fontSize: 19 }}>Cancel order #{order.order_number}?</h2>
          {formError && <Alert>{formError}</Alert>}
          <TextArea
            label="Reason"
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null); }}
            error={error ?? undefined}
            placeholder="e.g. Sold out of the main dish"
          />
          {paid && <Alert kind="info">The guest has already paid. After cancelling you can refund them from this page.</Alert>}
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={cancel.isPending}>Keep order</button>
          <Button type="submit" loading={cancel.isPending} loadingText="Cancelling…">Cancel order</Button>
        </div>
      </form>
    </Modal>
  );
}

function StatusCard({ order }: { order: AdminOrder }) {
  const { push } = useToast();
  const update = useUpdateStatus();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextStatus(order);
  const prev = previousStatus(order);
  const stages = flow(order.order_type);
  const stamps: Partial<Record<OrderStatus, string | null | undefined>> = {
    PLACED: order.placed_at ?? order.created_at,
    CONFIRMED: order.confirmed_at,
    READY: order.ready_at,
    DELIVERED: order.delivered_at,
  };
  const cancelled = isCancelled(order.status);
  // READY isn't a delivery stage, but the kitchen can still set it; keep it visible so the stepper stays truthful.
  const shown: OrderStatus[] = order.status === 'READY' && order.order_type === 'DELIVERY' ? ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] : stages;
  const currentIndex = shown.indexOf(order.status);

  function move(to: OrderStatus, verb: string) {
    setError(null);
    update.mutate(
      { order, status: to },
      {
        onSuccess: () => push(`${verb}: ${STATUS_LABEL[to].toLowerCase()}`),
        onError: (e) => setError(parseError(e).display),
      },
    );
  }

  return (
    <section className="card ad-card-pad" aria-labelledby="od-status">
      <h2 id="od-status" className="ad-rowhead-title">Status</h2>
      {cancelled ? (
        <div className="ad-cancelled">
          <span className={`badge ${statusBadgeClass(order.status)}`}>{STATUS_LABEL[order.status]}</span>
          {order.cancelled_at && <span className="ad-muted"> {when(order.cancelled_at)}</span>}
          {order.cancellation_reason && <p>“{order.cancellation_reason}”</p>}
        </div>
      ) : (
        <ol className="ad-steps" aria-label="Order progress">
          {shown.map((s, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
            return (
              <li key={s} className={state} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="ad-step-dot" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
                <span className="ad-step-text">{STATUS_LABEL[s]}</span>
                {stamps[s] && state !== 'todo' && <span className="ad-muted">{when(stamps[s])}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {needsPayment(order) && <Alert kind="info">The guest hasn&apos;t paid yet. You can still confirm the order if you want to start on it.</Alert>}
      {error && <Alert>{error}</Alert>}

      {!isFinished(order.status) && (
        <div className="ad-actions" style={{ marginTop: 14 }}>
          {next && (
            <Button loading={update.isPending} loadingText="Updating…" onClick={() => move(next, 'Order updated')}>
              {ACTION_LABEL[next] ?? STATUS_LABEL[next]}
            </Button>
          )}
          {ownerCanCancel(order.status) && (
            <Button variant="ghost" onClick={() => setCancelling(true)} disabled={update.isPending}>Cancel order</Button>
          )}
        </div>
      )}
      {prev && !isFinished(order.status) && (
        <p style={{ margin: '12px 0 0' }}>
          <button type="button" className="ad-link" disabled={update.isPending} onClick={() => move(prev, 'Moved back')}>
            Tapped too early? Move back to {STATUS_LABEL[prev].toLowerCase()}
          </button>
        </p>
      )}
      {order.status === 'DELIVERED' && <p className="ad-muted" style={{ margin: '12px 0 0' }}>This order is complete.</p>}
      {cancelling && <CancelModal order={order} onClose={() => setCancelling(false)} />}
    </section>
  );
}

function PaymentCard({ order }: { order: AdminOrder }) {
  const [refunding, setRefunding] = useState(false);
  const p = order.payment;
  const refundedAmount = toNumber(p?.refund_amount);
  const eligible = canRefund(order);

  return (
    <section className="card ad-card-pad" aria-labelledby="od-pay">
      <div className="ad-rowhead">
        <h2 id="od-pay" className="ad-rowhead-title">Payment</h2>
        <PayBadge order={order} />
      </div>

      {needsRefund(order) && (
        <Alert kind="info">This order was cancelled after the guest paid. Refund them to settle it.</Alert>
      )}

      <dl className="ad-kvs">
        <Row label="Amount">{formatMoney(p?.amount ?? order.total_amount)}</Row>
        {p?.payment_method && <Row label="Method">{paymentMethodLabel(p.payment_method)}</Row>}
        {p?.paid_at && <Row label="Paid">{when(p.paid_at)}</Row>}
        {p?.transaction_id && <Row label="Reference"><code className="ad-code">{p.transaction_id}</code></Row>}
        {order.payment_status === 'REFUNDED' && (
          <>
            {refundedAmount > 0 && <Row label="Refunded">{formatMoney(refundedAmount)}</Row>}
            {p?.refunded_at && <Row label="Refunded on">{when(p.refunded_at)}</Row>}
            {p?.refund_reason && <Row label="Reason">{p.refund_reason}</Row>}
          </>
        )}
      </dl>

      {eligible && (
        <div className="ad-actions" style={{ marginTop: 12 }}>
          <Button variant={needsRefund(order) ? 'primary' : 'ghost'} onClick={() => setRefunding(true)}>Refund…</Button>
        </div>
      )}
      {order.payment_status === 'PENDING' && !isCancelled(order.status) && order.status !== 'PLACED' && (
        <p className="ad-muted" style={{ margin: '12px 0 0' }}>Cash is collected when the order is handed over.</p>
      )}
      {refunding && <RefundModal order={order} onClose={() => setRefunding(false)} />}
    </section>
  );
}

export function OrderDetailView({ id }: { id: string }) {
  const query = useAdminOrder(id);
  const now = useNow(30_000);

  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading order">
        <div className="ad-skel" style={{ height: 70, borderRadius: 16, marginBottom: 16 }} />
        <div className="ad-skel" style={{ height: 320, borderRadius: 16 }} />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const err = parseError(query.error);
    const missing = err instanceof ApiError && err.status === 404;
    return (
      <div className="card ad-empty" role="alert">
        <div className="ad-empty-icon" aria-hidden="true">{missing ? '🔍' : '⚠️'}</div>
        <strong>{missing ? 'We can’t find that order' : 'We couldn’t load this order'}</strong>
        <span>{missing ? 'It may have been removed, or it belongs to another restaurant.' : err.display}</span>
        {missing ? <Link href="/owner/orders" className="btn btn-primary">Back to orders</Link> : <Button onClick={() => query.refetch()}>Try again</Button>}
      </div>
    );
  }

  const o = query.data;
  const items = o.items ?? [];
  const discount = toNumber(o.discount_amount);
  const fee = toNumber(o.delivery_fee);
  const hasGuest = !!(o.customer_name || o.customer_email || o.customer_phone);
  const notes = [o.customer_notes, o.special_instructions].filter((n): n is string => !!n?.trim());

  return (
    <>
      <Link href="/owner/orders" className="ad-back">← All orders</Link>
      <div className="ad-head">
        <div>
          <h1>Order #{o.order_number}</h1>
          <p>
            <span aria-hidden="true">{TYPE_ICON[o.order_type]}</span> {TYPE_LABEL[o.order_type]} · placed {when(o.placed_at ?? o.created_at)} ({timeAgo(o.placed_at ?? o.created_at, now)})
          </p>
        </div>
        <div className="ad-head-actions">
          <span className={`badge ${statusBadgeClass(o.status)}`}>{STATUS_LABEL[o.status]}</span>
          <PayBadge order={o} />
        </div>
      </div>

      <div className="ad-detail">
        <div className="ad-stack">
          <section className="card ad-card-pad" aria-labelledby="od-items">
            <h2 id="od-items" className="ad-rowhead-title">Items</h2>
            <ul className="ad-lines">
              {items.map((i) => (
                <li key={i.id}>
                  <div className="ad-line-main">
                    <strong>{i.quantity}× {i.item_name}</strong>
                    {i.customizations?.map((c) => (
                      <div key={c.id} className="ad-muted">{c.customization_name}: {c.option_name} {formatModifier(c.price_modifier)}</div>
                    ))}
                    {i.add_ons?.map((a) => (
                      <div key={a.id} className="ad-muted">+ {a.addon_name} {formatModifier(a.addon_price)}</div>
                    ))}
                    {i.special_instructions?.trim() && <div className="ad-note">“{i.special_instructions}”</div>}
                  </div>
                  <span className="ad-line-price">{formatMoney(i.subtotal)}</span>
                </li>
              ))}
              {items.length === 0 && <li className="ad-muted">No items on this order.</li>}
            </ul>
            <dl className="ad-totals">
              <Row label="Subtotal">{formatMoney(o.subtotal)}</Row>
              <Row label="Tax">{formatMoney(o.tax_amount)}</Row>
              {fee > 0 && <Row label="Delivery fee">{formatMoney(fee)}</Row>}
              {discount > 0 && <Row label={o.coupon_code ? `Discount (${o.coupon_code})` : 'Discount'}>−{formatMoney(discount)}</Row>}
              <div className="ad-kv total">
                <dt>Total</dt>
                <dd>{formatMoney(o.total_amount)}</dd>
              </div>
            </dl>
          </section>

          {notes.length > 0 && (
            <section className="card ad-card-pad" aria-labelledby="od-notes">
              <h2 id="od-notes" className="ad-rowhead-title">Notes from the guest</h2>
              {notes.map((n) => (
                <p key={n} className="ad-note-block">{n}</p>
              ))}
            </section>
          )}
        </div>

        <div className="ad-stack">
          <StatusCard order={o} />

          <section className="card ad-card-pad" aria-labelledby="od-guest">
            <h2 id="od-guest" className="ad-rowhead-title">Guest &amp; fulfilment</h2>
            <dl className="ad-kvs">
              <Row label="Guest">{customerLabel(o)}</Row>
              {hasGuest && o.customer_email && o.customer_name && <Row label="Email"><a href={`mailto:${o.customer_email}`}>{o.customer_email}</a></Row>}
              {o.customer_phone && <Row label="Phone"><a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></Row>}
              {o.order_type === 'DELIVERY' && (
                <>
                  {o.delivery_address && (
                    <Row label="Deliver to">
                      {o.delivery_address}
                      {(o.delivery_city || o.delivery_postal_code) && <div className="ad-muted">{[o.delivery_city, o.delivery_postal_code].filter(Boolean).join(' · ')}</div>}
                    </Row>
                  )}
                  {o.delivery_instructions && <Row label="Instructions">{o.delivery_instructions}</Row>}
                </>
              )}
              {o.order_type === 'PICKUP' && o.pickup_time && <Row label="Pickup time">{when(o.pickup_time)}</Row>}
              {o.order_type === 'DINE_IN' && (
                <>
                  {o.table_number && <Row label="Table">{o.table_number}</Row>}
                  {o.number_of_guests ? <Row label="Party size">{o.number_of_guests}</Row> : null}
                </>
              )}
            </dl>
          </section>

          <PaymentCard order={o} />
        </div>
      </div>
    </>
  );
}
