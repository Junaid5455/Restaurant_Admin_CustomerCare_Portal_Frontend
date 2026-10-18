import { STATUS_LABEL, stages } from '@/lib/order-status';
import type { OrderStatus } from '@/lib/api/orders';

/** The stage tracker (Placed → … → Delivered/Ready). Cancelled orders have no happy-path position, so show nothing. */
export function StatusProgress({ status, type }: { status: OrderStatus; type: string }) {
  const flow = stages(type);
  const reached = flow.indexOf(status);
  if (reached < 0) return null;
  return (
    <ol className="sv-progress" aria-label="Order progress">
      {flow.map((s, i) => (
        <li key={s} className={i < reached ? 'done' : i === reached ? 'current' : ''} aria-current={i === reached ? 'step' : undefined}>
          <span className="dot" aria-hidden="true">{i < reached || (i === reached && s === 'DELIVERED') ? '✓' : i + 1}</span>
          <span className="txt">{STATUS_LABEL[s]}</span>
        </li>
      ))}
    </ol>
  );
}
