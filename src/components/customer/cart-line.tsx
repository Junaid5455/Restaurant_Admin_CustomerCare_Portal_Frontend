'use client';

import { useId } from 'react';
import { Modal } from '@/components/ui/modal';
import { formatModifier, formatMoney, toNumber } from '@/lib/format';
import type { CartItem } from '@/lib/api/cart';

export const MAX_QTY = 20;

/** The chosen options and add-ons of a line, as short readable strings. */
export function lineDetails(line: CartItem): string[] {
  return [
    ...line.customizations.map((c) => `${c.customization_name}: ${c.option_name}${formatModifier(c.price_modifier) ? ` (${formatModifier(c.price_modifier)})` : ''}`),
    ...line.add_ons.map((a) => `+ ${a.addon_name}${toNumber(a.addon_price) ? ` (${formatMoney(a.addon_price)})` : ''}`),
  ];
}

export function CartLine({
  line,
  busy,
  onQuantity,
  onRemove,
}: {
  line: CartItem;
  busy: boolean;
  onQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  const details = lineDetails(line);
  return (
    <li className="sv-line" aria-busy={busy || undefined}>
      <div className="sv-line-main">
        <div className="sv-line-name">{line.item_name}</div>
        {details.length > 0 && (
          <ul className="sv-line-details">
            {details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
        {line.special_instructions && <p className="sv-line-note">“{line.special_instructions}”</p>}
        <div className="sv-line-unit">{formatMoney(line.item_price)} each</div>
      </div>

      <div className="sv-line-side">
        <div className="sv-qty" role="group" aria-label={`Quantity of ${line.item_name}`}>
          <button type="button" aria-label="Decrease quantity" disabled={busy || line.quantity <= 1} onClick={() => onQuantity(line.quantity - 1)}>
            −
          </button>
          <output aria-live="polite">{line.quantity}</output>
          <button type="button" aria-label="Increase quantity" disabled={busy || line.quantity >= MAX_QTY} onClick={() => onQuantity(line.quantity + 1)}>
            +
          </button>
        </div>
        <div className="sv-line-total">{formatMoney(line.subtotal)}</div>
        <button type="button" className="sv-link-btn" disabled={busy} onClick={onRemove} aria-label={`Remove ${line.item_name}`}>
          Remove
        </button>
      </div>
    </li>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Modal onClose={onClose} labelledBy={titleId} size="sm">
      <div className="sv-modal-body" style={{ paddingTop: 26 }}>
        <h2 id={titleId} className="sv-modal-title" style={{ fontSize: 19 }}>{title}</h2>
        <p style={{ color: 'var(--fg-2)', margin: '8px 0 0' }}>{message}</p>
      </div>
      <div className="sv-modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep it</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
