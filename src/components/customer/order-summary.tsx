import type { ReactNode } from 'react';
import { formatMoney, toNumber } from '@/lib/format';

interface Props {
  subtotal: string | number;
  tax: string | number;
  /** Pass null to show a "calculated at checkout" note instead of an amount. */
  deliveryFee: string | number | null;
  total: string | number;
  title?: string;
  children?: ReactNode;
}

export function OrderSummary({ subtotal, tax, deliveryFee, total, title = 'Order summary', children }: Props) {
  return (
    <section className="card sv-summary" aria-label={title}>
      <h2>{title}</h2>
      {children}
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(subtotal)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{formatMoney(tax)}</dd>
        </div>
        <div>
          <dt>Delivery fee</dt>
          <dd>
            {deliveryFee === null ? (
              <span className="muted">At checkout</span>
            ) : toNumber(deliveryFee) === 0 ? (
              'Free'
            ) : (
              formatMoney(deliveryFee)
            )}
          </dd>
        </div>
        <div className="total">
          <dt>Total</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
      </dl>
    </section>
  );
}
