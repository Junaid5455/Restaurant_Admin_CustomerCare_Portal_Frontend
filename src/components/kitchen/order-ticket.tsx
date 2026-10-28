'use client';

import type { KitchenOrder } from '@/lib/api/kitchen';
import { TYPE_ICON, TYPE_LABEL, clockStart, formatClock, itemCount, shortNumber, targetMinutes, urgency, type KdsPrefs } from '@/lib/kitchen';

interface Props {
  order: KitchenOrder;
  now: number;
  prefs: KdsPrefs;
  /** When this device pressed Start, if it did. */
  startedAt?: number;
  /** Arrived since the cook last looked: flashes until acknowledged. */
  fresh: boolean;
  busy: boolean;
  onStart: () => void;
  onReady: () => void;
  onAck: () => void;
}

export function OrderTicket({ order, now, prefs, startedAt, fresh, busy, onStart, onReady, onAck }: Props) {
  const elapsed = now - clockStart(order);
  const target = targetMinutes(order, prefs);
  const level = urgency(elapsed, target);
  const pct = Math.min(100, Math.round((elapsed / (target * 60_000)) * 100));
  const cooking = order.status === 'PREPARING';
  const place = order.order_type === 'DINE_IN' && order.table_number ? `Table ${order.table_number}` : TYPE_LABEL[order.order_type];
  const notes = [order.special_instructions, order.customer_notes].filter((n): n is string => !!n && !!n.trim());
  const label = `Order ${shortNumber(order.order_number)}`;

  return (
    <article
      className={`kds-ticket u-${level} ${cooking ? 'is-cooking' : ''} ${fresh ? 'is-fresh' : ''}`}
      aria-label={`${label}, ${place}, ${cooking ? 'cooking' : 'new'}, ${Math.floor(elapsed / 60_000)} minutes`}
      onClick={fresh ? onAck : undefined}
    >
      <header className="kds-ticket-head">
        <div>
          <div className="kds-num" title={order.order_number}>#{shortNumber(order.order_number)}</div>
          <div className="kds-place">
            <span aria-hidden="true">{TYPE_ICON[order.order_type]}</span> {place}
            <span className="kds-count"> · {itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'}</span>
          </div>
        </div>
        <div className="kds-timer" role="timer" aria-label={`${cooking ? 'In kitchen' : 'Waiting'} ${formatClock(elapsed)}`}>
          <span className="kds-clock">{formatClock(elapsed)}</span>
          <span className="kds-clock-sub">
            {level === 'late' ? `Over ${target} min` : cooking && startedAt ? `Cooking ${formatClock(now - startedAt)}` : cooking ? 'In kitchen' : 'Waiting'}
          </span>
        </div>
      </header>
      <div className="kds-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>

      {fresh && <div className="kds-newtag">NEW ORDER</div>}

      <ul className="kds-items">
        {order.items.map((it) => (
          <li key={it.id}>
            <div className="kds-item-line">
              <span className="kds-qty">{it.quantity}×</span>
              <span className="kds-item-name">{it.item_name}</span>
            </div>
            {(it.customizations.length > 0 || it.add_ons.length > 0) && (
              <ul className="kds-mods">
                {it.customizations.map((c, i) => (
                  <li key={`c${i}`}>
                    <span className="kds-mod-k">{c.customization_name}:</span> {c.option_name}
                  </li>
                ))}
                {it.add_ons.map((a, i) => (
                  <li key={`a${i}`}>+ {a.addon_name}</li>
                ))}
              </ul>
            )}
            {it.special_instructions?.trim() && <div className="kds-note">📝 {it.special_instructions}</div>}
          </li>
        ))}
        {order.items.length === 0 && <li className="kds-mods">No items on this ticket.</li>}
      </ul>

      {notes.map((n, i) => (
        <div key={i} className="kds-note kds-note-order">📝 {n}</div>
      ))}

      <button
        type="button"
        className={`kds-action ${cooking ? 'is-ready' : 'is-start'}`}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          cooking ? onReady() : onStart();
        }}
        aria-label={`${cooking ? 'Mark ready' : 'Start cooking'}: ${label}`}
      >
        {busy ? 'Updating…' : cooking ? '✓ Mark ready' : '▶ Start cooking'}
      </button>
    </article>
  );
}
