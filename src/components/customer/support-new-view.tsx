'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { TextArea } from '@/components/ui/text-area';
import { TextField } from '@/components/ui/text-field';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { TICKETS_KEY } from '@/hooks/use-tickets';
import { ordersApi, type Order } from '@/lib/api/orders';
import { CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL, ORDER_CATEGORIES, supportApi, type TicketCategory } from '@/lib/api/support';
import { ApiError, parseError } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { formatDateTime } from '@/lib/pickup';

const SUBJECT_MAX = 200;
const DESC_MAX = 3000;

function orderLabel(o: Order): string {
  return `#${o.order_number} · ${o.restaurant_name} · ${formatDateTime(o.created_at)} · ${formatMoney(o.total_amount)}`;
}

export function SupportNewView() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const orderParam = params.get('order');
  const catParam = params.get('category');

  const [category, setCategory] = useState<TicketCategory | ''>(
    CATEGORIES.includes(catParam as TicketCategory) ? (catParam as TicketCategory) : orderParam ? 'ORDER_ISSUE' : '',
  );
  const [orderId, setOrderId] = useState(orderParam ?? '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Recent orders to pick from. If we arrive from an order that isn't among them, load it too.
  const recent = useQuery({ queryKey: ['orders', 'for-support'], queryFn: () => ordersApi.list({ page: 1, page_size: 20 }), staleTime: 60_000 });
  const linked = useQuery({
    queryKey: ['order', orderParam],
    queryFn: () => ordersApi.get(orderParam as string),
    enabled: !!orderParam && !!recent.data && !recent.data.orders.some((o) => o.id === orderParam),
    retry: false,
  });

  const orders = useMemo(() => {
    const list = [...(recent.data?.orders ?? [])];
    if (linked.data && !list.some((o) => o.id === linked.data.id)) list.unshift(linked.data);
    return list;
  }, [recent.data, linked.data]);

  const selectedOrder = orders.find((o) => o.id === orderId);
  const orderMissing = !!orderParam && linked.isError && !orders.some((o) => o.id === orderParam);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (!category) next.category = 'Choose what this is about';
    if (subject.trim().length < 5) next.subject = 'Give your ticket a short title (at least 5 characters)';
    if (description.trim().length < 10) next.description = 'Tell us a little more (at least 10 characters)';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
      // Wait one frame so the error state has rendered, then move focus to the first invalid field.
      requestAnimationFrame(() => document.getElementById('support-form')?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    setBusy(true);
    try {
      const ticket = await supportApi.create({
        subject: subject.trim(),
        description: description.trim(),
        category: category as TicketCategory,
        ...(selectedOrder ? { related_order: selectedOrder.id, ...(selectedOrder.restaurant ? { restaurant: selectedOrder.restaurant } : {}) } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
      push('Ticket sent. We’ll reply here.');
      router.push(`/customer/support/${ticket.id}`);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : parseError(err);
      setErrors(apiErr.fieldErrors);
      if (!Object.keys(apiErr.fieldErrors).length) setFormError(apiErr.display);
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/customer/support" className="sv-back">← All tickets</Link>
      <div className="sv-page-head" style={{ marginTop: 10 }}>
        <h1>{selectedOrder ? 'Report a problem with your order' : 'New support ticket'}</h1>
        <p>Tell us what happened and we’ll get back to you here. You can keep chatting once it’s sent.</p>
      </div>

      <form id="support-form" className="card sv-acct-card sv-support-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="sup-cat">What’s this about?</label>
          <select
            id="sup-cat"
            className={`input sv-select-input ${errors.category ? 'input-error' : ''}`}
            value={category}
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={errors.category ? 'sup-cat-err' : undefined}
            onChange={(e) => { setCategory(e.target.value as TicketCategory); setErrors((x) => ({ ...x, category: '' })); }}
          >
            <option value="">Choose a category…</option>
            <optgroup label="About an order">
              {ORDER_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}</option>)}
            </optgroup>
            <optgroup label="Something else">
              {CATEGORIES.filter((c) => !ORDER_CATEGORIES.includes(c)).map((c) => <option key={c} value={c}>{CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}</option>)}
            </optgroup>
          </select>
          {errors.category && <p id="sup-cat-err" className="field-error" role="alert">{errors.category}</p>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sup-order">
            Related order <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>(optional)</span>
          </label>
          <select id="sup-order" className="input sv-select-input" value={orderId} onChange={(e) => setOrderId(e.target.value)} disabled={recent.isPending}>
            <option value="">{recent.isPending ? 'Loading your orders…' : 'No related order'}</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{orderLabel(o)}</option>)}
          </select>
          {orderMissing ? (
            <p className="field-hint">We couldn’t load that order, but you can still send your ticket.</p>
          ) : (
            <p className="field-hint">
              {selectedOrder ? 'The restaurant and order details are attached for our team.' : 'Pick the order this is about so we can find it faster.'}
            </p>
          )}
          {recent.isError && <p className="field-hint">We couldn’t load your orders right now. You can still send the ticket.</p>}
        </div>

        <TextField
          label="Title"
          value={subject}
          maxLength={SUBJECT_MAX}
          placeholder="e.g. My biryani arrived cold"
          onChange={(e) => { setSubject(e.target.value); setErrors((x) => ({ ...x, subject: '' })); }}
          error={errors.subject}
        />
        <TextArea
          label="What happened?"
          rows={6}
          value={description}
          maxLength={DESC_MAX}
          counter
          placeholder="Describe the problem. Include what you ordered, what went wrong, and what you’d like us to do."
          onChange={(e) => { setDescription(e.target.value); setErrors((x) => ({ ...x, description: '' })); }}
          error={errors.description}
        />

        {formError && <Alert>{formError}</Alert>}
        <div className="sv-acct-actions">
          <Button type="submit" loading={busy} loadingText="Sending…">Send ticket</Button>
          <Link href="/customer/support" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
