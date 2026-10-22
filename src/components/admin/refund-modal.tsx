'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { TextArea } from '@/components/ui/text-area';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useRefund } from '@/hooks/use-admin-orders';
import type { AdminOrder } from '@/lib/api/admin-orders';
import { ApiError, parseError } from '@/lib/errors';
import { CURRENCY_SYMBOL } from '@/lib/constants';
import { formatMoney, toNumber } from '@/lib/format';
import { paymentMethodLabel } from '@/lib/admin-orders';

/** Refund a paid order, in full or in part. */
export function RefundModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const { push } = useToast();
  const refund = useRefund();
  const payment = order.payment;
  const max = toNumber(payment?.amount ?? order.total_amount);

  const [amount, setAmount] = useState(String(max));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const value = Number(amount);
  const partial = Number.isFinite(value) && value > 0 && value < max;

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!payment) return;
    const found: typeof errors = {};
    if (amount.trim() === '' || Number.isNaN(value) || value <= 0) found.amount = 'Enter an amount above 0';
    else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) found.amount = 'Use at most 2 decimal places';
    else if (value > max) found.amount = `You can refund at most ${formatMoney(max)}`;
    if (!reason.trim()) found.reason = 'Add a short reason for your records';
    else if (reason.trim().length > 200) found.reason = 'Keep the reason under 200 characters';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.sv-modal [aria-invalid="true"]')?.focus());
      return;
    }
    refund.mutate(
      { order, paymentId: payment.id, amount: Number(value.toFixed(2)), reason: reason.trim() },
      {
        onSuccess: () => {
          push(`Refunded ${formatMoney(value)} for order #${order.order_number}`);
          onClose();
        },
        onError: (err) => {
          const e2 = parseError(err);
          setFormError(e2 instanceof ApiError && e2.status === 403 ? "Your account isn't allowed to issue refunds for this payment." : e2.display);
        },
      },
    );
  }

  return (
    <Modal onClose={() => !refund.isPending && onClose()} labelledBy="refund-title">
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body">
            <h2 id="refund-title" className="sv-modal-title">Refund order #{order.order_number}</h2>
            {!payment ? (
              <Alert kind="info">Refunds can&apos;t be issued from here yet because this order didn&apos;t come with its payment details. Ask your administrator to enable owner refunds.</Alert>
            ) : (
              <>
                <p className="ad-refund-facts">
                  Paid <strong>{formatMoney(payment.amount)}</strong> by {paymentMethodLabel(payment.payment_method) || 'card'}.
                </p>
                {formError && <Alert>{formError}</Alert>}
                <TextField
                  label={`Refund amount (${CURRENCY_SYMBOL})`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrors((x) => ({ ...x, amount: undefined })); }}
                  error={errors.amount}
                  hint={`Up to ${formatMoney(max)}.`}
                />
                <button type="button" className="ad-link" style={{ width: 'fit-content' }} onClick={() => { setAmount(String(max)); setErrors((x) => ({ ...x, amount: undefined })); }}>
                  Refund the full amount
                </button>
                <TextArea
                  label="Reason"
                  rows={3}
                  maxLength={200}
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }}
                  error={errors.reason}
                  placeholder="e.g. Order cancelled before it was prepared"
                />
                {partial && (
                  <Alert kind="info">
                    This returns {formatMoney(value)} of {formatMoney(max)}. The payment is then recorded as refunded, and a payment can only be refunded once.
                  </Alert>
                )}
              </>
            )}
          </div>
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={refund.isPending}>{payment ? 'Cancel' : 'Close'}</button>
          {payment && (
            <Button type="submit" loading={refund.isPending} loadingText="Refunding…">
              Refund {Number.isFinite(value) && value > 0 ? formatMoney(value) : ''}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
