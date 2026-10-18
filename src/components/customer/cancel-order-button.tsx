'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { useToast } from '@/components/ui/toast';
import { ordersApi } from '@/lib/api/orders';
import { parseError } from '@/lib/errors';

/** "Cancel order" with a confirmation. Only render it while `canCancel(status)` is true. */
export function CancelOrderButton({ orderId, className = 'btn btn-ghost' }: { orderId: string; className?: string }) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await ordersApi.cancel(orderId);
      setOpen(false);
      push('Your order was cancelled.', 'info');
    } catch (e) {
      setOpen(false);
      push(parseError(e).display, 'error');
    } finally {
      setBusy(false);
      // The status may have moved on (e.g. the kitchen already started), so always resync.
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['order-track', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Cancel order
      </button>
      {open && (
        <ConfirmDialog
          title="Cancel this order?"
          message="The restaurant will be told you no longer want it. You can order again any time."
          confirmLabel="Cancel order"
          busy={busy}
          onConfirm={cancel}
          onClose={() => !busy && setOpen(false)}
        />
      )}
    </>
  );
}
