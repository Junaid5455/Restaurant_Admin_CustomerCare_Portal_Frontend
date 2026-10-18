import Link from 'next/link';
import { ReorderButton } from './reorder-button';
import type { Order } from '@/lib/api/orders';
import { formatMoney } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';
import { STATUS_LABEL, TYPE_ICON, TYPE_LABEL, isFinished, needsPayment, paymentLabel, statusBadgeClass } from '@/lib/order-status';

export function OrderCard({ order }: { order: Order }) {
  const finished = isFinished(order.status);
  const unpaid = needsPayment(order);
  const pay = paymentLabel(order);
  const summary = order.items.map((i) => `${i.quantity}× ${i.item_name}`).join(', ');
  const count = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <article className="card sv-order" aria-label={`Order ${order.order_number} from ${order.restaurant_name}`}>
      <div className="sv-order-top">
        <div className="sv-order-id">
          <h2>
            <Link href={`/customer/orders/${order.id}`}>{order.restaurant_name}</Link>
          </h2>
          <p>
            #{order.order_number} · {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="sv-order-badges">
          <span className={`badge ${statusBadgeClass(order.status)}`}>{STATUS_LABEL[order.status]}</span>
          <span className={`badge ${pay.cls}`}>{pay.text}</span>
        </div>
      </div>

      <p className="sv-order-items" title={summary}>
        {summary || 'No items'}
      </p>

      <div className="sv-order-foot">
        <div className="sv-order-meta">
          <span>{TYPE_ICON[order.order_type]} {TYPE_LABEL[order.order_type]}</span>
          <span>{count} {count === 1 ? 'item' : 'items'}</span>
          <strong>{formatMoney(order.total_amount)}</strong>
        </div>
        <div className="sv-order-actions">
          {unpaid && (
            <Link href={`/customer/checkout/payment/${order.id}`} className="btn btn-primary">Pay now</Link>
          )}
          {!finished && !unpaid && (
            <Link href={`/customer/orders/${order.id}/track`} className="btn btn-primary">Track order</Link>
          )}
          {finished && <ReorderButton order={order} className="btn btn-primary" label="Order again" />}
          <Link href={`/customer/orders/${order.id}`} className="btn btn-ghost">Details</Link>
        </div>
      </div>
    </article>
  );
}

export function OrderCardSkeleton() {
  return <div className="sv-skel" style={{ height: 150, borderRadius: 20 }} aria-hidden="true" />;
}
