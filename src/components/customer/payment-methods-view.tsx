'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountShell, SectionSkeleton } from './account-shell';
import { ConfirmDialog } from './cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { PAYMENT_TYPE_LABEL, isExpired, paymentMethodsApi, type SavedPaymentMethod } from '@/lib/api/payment-methods';
import { parseError } from '@/lib/errors';

const KEY = ['payment-methods'] as const;

function title(m: SavedPaymentMethod): string {
  const type = PAYMENT_TYPE_LABEL[m.payment_method_type] ?? 'Payment method';
  if (m.card_last_four) return `${m.card_brand || type} •••• ${m.card_last_four}`;
  return m.card_brand || type;
}

function expiry(m: SavedPaymentMethod): string | null {
  if (!m.card_expiry_month || !m.card_expiry_year) return null;
  return `${String(m.card_expiry_month).padStart(2, '0')}/${String(m.card_expiry_year).slice(-2)}`;
}

export function PaymentMethodsView() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const methods = useQuery({ queryKey: KEY, queryFn: paymentMethodsApi.list });
  const [removing, setRemoving] = useState<SavedPaymentMethod | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = methods.data ?? [];

  async function makeDefault(m: SavedPaymentMethod) {
    setBusyId(m.id);
    setError(null);
    try {
      await paymentMethodsApi.setDefault(m.id);
      push(`${title(m)} is now your default`);
    } catch (e) {
      setError(parseError(e).display);
    } finally {
      await queryClient.invalidateQueries({ queryKey: KEY });
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId(removing.id);
    setError(null);
    try {
      await paymentMethodsApi.remove(removing.id);
      push(`Removed ${title(removing)}`, 'info');
    } catch (e) {
      setError(parseError(e).display);
    } finally {
      setRemoving(null);
      await queryClient.invalidateQueries({ queryKey: KEY });
      setBusyId(null);
    }
  }

  return (
    <AccountShell active="payments" title="Payment methods" description="Cards and wallets you’ve saved for faster checkout.">
      {error && <Alert>{error}</Alert>}

      {methods.isPending ? (
        <SectionSkeleton rows={2} height={92} />
      ) : methods.isError ? (
        <div className="sv-acct-inline">
          <Alert>{parseError(methods.error).display}</Alert>
          <Button variant="ghost" onClick={() => methods.refetch()}>Try again</Button>
        </div>
      ) : list.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">💳</div>
          <h2>No saved payment methods</h2>
          <p>You can still pay by card or cash each time you check out.</p>
          <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
        </div>
      ) : (
        <ul className="sv-acct-list sv-acct-cards">
          {list.map((m) => {
            const expired = isExpired(m);
            const exp = expiry(m);
            return (
              <li key={m.id} className={`card sv-acct-item ${m.is_default ? 'is-default' : ''}`}>
                <div className="sv-acct-item-top">
                  <h2><span aria-hidden="true">💳 </span>{title(m)}</h2>
                  <span className="sv-acct-badges">
                    {m.is_default && <span className="badge badge-accent">Default</span>}
                    {expired && <span className="badge badge-crit">Expired</span>}
                  </span>
                </div>
                <p className="sv-acct-item-text">
                  {PAYMENT_TYPE_LABEL[m.payment_method_type] ?? 'Payment method'}
                  {exp && <> · {expired ? 'Expired' : 'Expires'} {exp}</>}
                </p>
                <div className="sv-acct-item-actions">
                  {!m.is_default && !expired && (
                    <button type="button" className="sv-link-btn" disabled={busyId === m.id} onClick={() => makeDefault(m)} aria-label={`Make ${title(m)} the default`}>
                      {busyId === m.id ? 'Saving…' : 'Make default'}
                    </button>
                  )}
                  <button type="button" className="sv-link-btn danger" disabled={busyId === m.id} onClick={() => setRemoving(m)} aria-label={`Remove ${title(m)}`}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {removing && (
        <ConfirmDialog
          title="Remove this payment method?"
          message={`${title(removing)} will be removed from your account.`}
          confirmLabel="Remove"
          busy={busyId === removing.id}
          onConfirm={confirmRemove}
          onClose={() => busyId !== removing.id && setRemoving(null)}
        />
      )}
    </AccountShell>
  );
}
