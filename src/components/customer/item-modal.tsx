'use client';

import { useId, useMemo, useState } from 'react';
import { ItemHeart } from './favorite-button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { SafeImage } from '@/components/ui/safe-image';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { CART_KEY, useCart } from '@/hooks/use-cart';
import { cartApi, type AddToCartInput } from '@/lib/api/cart';
import { restaurantsApi, type Customization, type MenuItem } from '@/lib/api/restaurants';
import { parseError } from '@/lib/errors';
import { formatModifier, formatMoney, toNumber } from '@/lib/format';

const MAX_QTY = 20;

const REQUIRED_MSG = 'Please complete the required options.';

export function ItemModal({
  item,
  restaurant,
  onClose,
}: {
  item: MenuItem;
  /** null when the dish is opened from Favorites: the API doesn't say which restaurant a favourite dish belongs to. */
  restaurant: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const cart = useCart();

  // The menu payload has no customizations or dietary flags, so load the full item.
  const detail = useQuery({
    queryKey: ['menu-item', item.id],
    queryFn: () => restaurantsApi.item(item.id),
    staleTime: 60_000,
  });
  const d = detail.data;

  const [picked, setPicked] = useState<Record<string, string[]>>({}); // customization id -> option ids
  const [texts, setTexts] = useState<Record<string, string>>({}); // TEXT_INPUT values
  const [addons, setAddons] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);

  const available = d ? d.is_available : item.is_available;
  const customizations = d?.customizations ?? [];
  const addOnList = d?.add_ons ?? [];

  // Mirrors the backend: unit price = base + selected option modifiers + add-ons; line total = unit × quantity.
  const unitPrice = useMemo(() => {
    let price = toNumber(item.price);
    for (const c of customizations) {
      for (const optionId of picked[c.id] ?? []) {
        price += toNumber(c.options.find((o) => o.id === optionId)?.price_modifier);
      }
    }
    for (const a of addOnList) if (addons.includes(a.id)) price += toNumber(a.price);
    return price;
  }, [item.price, customizations, addOnList, picked, addons]);

  const hasMissingRequired = customizations.some(
    (c) => c.is_required && !(c.type === 'TEXT_INPUT' ? texts[c.id]?.trim() : picked[c.id]?.length),
  );

  function choose(c: Customization, optionId: string) {
    setErrors((e) => ({ ...e, [c.id]: '' }));
    setPicked((p) => {
      if (c.type === 'SINGLE_SELECT') return { ...p, [c.id]: [optionId] };
      const current = p[c.id] ?? [];
      return { ...p, [c.id]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const c of customizations) {
      if (!c.is_required) continue;
      const ok = c.type === 'TEXT_INPUT' ? !!texts[c.id]?.trim() : (picked[c.id]?.length ?? 0) > 0;
      if (!ok) next[c.id] = c.type === 'TEXT_INPUT' ? 'This is required' : 'Choose an option';
    }
    setErrors(next);
    const firstBad = Object.keys(next)[0];
    if (firstBad) {
      setFormError(REQUIRED_MSG);
      document.getElementById(`cust-${firstBad}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  }

  function buildPayload(): AddToCartInput {
    // The cart API only takes option ids, so free-text answers travel in the line's special instructions.
    const lines = customizations
      .filter((c) => c.type === 'TEXT_INPUT' && texts[c.id]?.trim())
      .map((c) => `${c.name}: ${texts[c.id].trim()}`);
    if (notes.trim()) lines.push(notes.trim());
    const payload: AddToCartInput = {
      menu_item_id: item.id,
      quantity: qty,
      customization_option_ids: customizations.filter((c) => c.type !== 'TEXT_INPUT').flatMap((c) => picked[c.id] ?? []),
      addon_ids: addons,
    };
    if (lines.length) payload.special_instructions = lines.join('\n');
    return payload;
  }

  async function submit(replaceCart = false) {
    setFormError(null);
    if (!validate()) return;

    // One restaurant per cart. Check up front so we can offer to start a new cart.
    const c = cart.data;
    const otherRestaurant = !!c && c.items.length > 0 && !!restaurant && !!c.restaurant && c.restaurant !== restaurant.id;
    if (otherRestaurant && !replaceCart) {
      setConflict(true);
      return;
    }

    setBusy(true);
    let keepConflictOpen = false;
    try {
      if (replaceCart) await cartApi.clear(await cartApi.get());
      const updated = await cartApi.add(buildPayload());
      queryClient.setQueryData(CART_KEY, updated);
      push(`Added ${qty} × ${item.name} to your cart · ${formatMoney(updated.total_amount)} so far`);
      onClose();
    } catch (e) {
      const err = parseError(e);
      if (/another restaurant/i.test(err.display)) {
        // The cart changed since we last fetched it (another tab or device).
        await queryClient.invalidateQueries({ queryKey: CART_KEY });
        keepConflictOpen = true;
      } else {
        setFormError(err.display);
      }
    } finally {
      setBusy(false);
      setConflict(keepConflictOpen);
    }
  }

  const blocked = !available || detail.isPending || detail.isError;
  const cartRestaurantName = cart.data?.restaurant_name;
  const cartLines = cart.data?.items.length ?? 0;

  return (
    <>
      <Modal onClose={onClose} labelledBy={titleId}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-hero">
            <ItemHeart itemId={item.id} name={item.name} className="sv-heart-float sv-heart-modal" />
            <button type="button" className="icon-btn sv-modal-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
            <SafeImage src={item.image} alt={item.name} fallback={<span aria-hidden="true">🍴</span>} />
          </div>

          <div className="sv-modal-body">
            <div>
              <h2 id={titleId} className="sv-modal-title">
                {item.name}
              </h2>
              <div className="sv-meta" style={{ marginTop: 8 }}>
                <span className="sv-price" style={{ fontSize: 17 }}>{formatMoney(item.price)}</span>
                <span>⏱ {item.prep_time} min</span>
                {item.review_count > 0 && toNumber(item.rating) > 0 && (
                  <span className="rating">★ {toNumber(item.rating).toFixed(1)} ({item.review_count})</span>
                )}
                {d?.calories ? <span>🔥 {d.calories} kcal</span> : null}
              </div>
              <div className="sv-tags" style={{ marginTop: 10 }}>
                {item.is_new && <span className="badge badge-violet">New</span>}
                {item.is_featured && <span className="badge badge-warn">⭐ Featured</span>}
                {d?.is_vegetarian && <span className="badge badge-good">🥬 Vegetarian</span>}
                {d?.is_vegan && <span className="badge badge-good">🌱 Vegan</span>}
                {d?.is_spicy && <span className="badge badge-crit">🌶 Spicy</span>}
              </div>
              {item.description && <p style={{ color: 'var(--fg-2)', marginTop: 12 }}>{item.description}</p>}
            </div>

            {!available && <Alert kind="info">This item is currently unavailable.</Alert>}

            {detail.isPending && (
              <div aria-busy="true" aria-label="Loading options" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="sv-skel" style={{ height: 84 }} />
                <div className="sv-skel" style={{ height: 84 }} />
              </div>
            )}

            {detail.isError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <Alert>{parseError(detail.error).display}</Alert>
                <Button variant="ghost" onClick={() => detail.refetch()}>
                  Retry
                </Button>
              </div>
            )}

            {customizations.map((c) => (
              <fieldset key={c.id} id={`cust-${c.id}`} className={`sv-group ${errors[c.id] ? 'invalid' : ''}`}>
                <legend>
                  {c.name}
                  {c.is_required && <span className="sv-req">Required</span>}
                  {c.type === 'MULTIPLE_SELECT' && <span style={{ color: 'var(--fg-3)', fontWeight: 500, fontSize: 12 }}>Pick any</span>}
                  {c.type === 'SINGLE_SELECT' && !c.is_required && (picked[c.id]?.length ?? 0) > 0 && (
                    <button type="button" className="sv-link-btn" onClick={() => setPicked((p) => ({ ...p, [c.id]: [] }))}>
                      Clear
                    </button>
                  )}
                </legend>

                {c.type === 'TEXT_INPUT' ? (
                  <input
                    className={`input ${errors[c.id] ? 'input-error' : ''}`}
                    aria-label={c.name}
                    maxLength={120}
                    value={texts[c.id] ?? ''}
                    onChange={(e) => {
                      setTexts((t) => ({ ...t, [c.id]: e.target.value }));
                      setErrors((er) => ({ ...er, [c.id]: '' }));
                    }}
                  />
                ) : (
                  c.options.map((o) => (
                    <label key={o.id} className="sv-opt">
                      <input
                        type={c.type === 'SINGLE_SELECT' ? 'radio' : 'checkbox'}
                        name={`opt-${c.id}`}
                        checked={picked[c.id]?.includes(o.id) ?? false}
                        onChange={() => choose(c, o.id)}
                      />
                      <span className="name">{o.name}</span>
                      <span className="extra">{formatModifier(o.price_modifier)}</span>
                    </label>
                  ))
                )}
                {errors[c.id] && (
                  <p className="field-error" role="alert" style={{ marginTop: 6 }}>
                    {errors[c.id]}
                  </p>
                )}
              </fieldset>
            ))}

            {addOnList.length > 0 && (
              <fieldset className="sv-group">
                <legend>
                  Add-ons <span style={{ color: 'var(--fg-3)', fontWeight: 500, fontSize: 12 }}>Optional</span>
                </legend>
                {addOnList.map((a) => (
                  <label key={a.id} className={`sv-opt ${a.is_available ? '' : 'off'}`}>
                    <input
                      type="checkbox"
                      disabled={!a.is_available}
                      checked={addons.includes(a.id)}
                      onChange={() => setAddons((cur) => (cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]))}
                    />
                    <span className="name">{a.name}</span>
                    <span className="extra">{a.is_available ? formatModifier(a.price) || 'Free' : 'Unavailable'}</span>
                  </label>
                ))}
              </fieldset>
            )}

            {d && (
              <div className="field">
                <label className="field-label" htmlFor={`${titleId}-notes`}>
                  Special instructions <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id={`${titleId}-notes`}
                  className="sv-textarea"
                  maxLength={300}
                  placeholder="Allergies, no onions, extra sauce…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}

            {formError && (formError !== REQUIRED_MSG || hasMissingRequired) && <Alert>{formError}</Alert>}
          </div>
        </div>

        <div className="sv-modal-foot">
          <div className="sv-qty" role="group" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
              −
            </button>
            <output aria-live="polite">{qty}</output>
            <button type="button" aria-label="Increase quantity" disabled={qty >= MAX_QTY} onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
          <Button block loading={busy} loadingText="Adding…" disabled={blocked} onClick={() => submit(false)}>
            {!available ? 'Unavailable' : detail.isPending ? 'Loading options…' : `Add to cart · ${formatMoney(unitPrice * qty)}`}
          </Button>
        </div>
      </Modal>

      {conflict && (
        <ConflictDialog
          currentName={cartRestaurantName}
          lines={cartLines}
          nextName={restaurant?.name ?? 'this restaurant'}
          busy={busy}
          onKeep={() => setConflict(false)}
          onReplace={() => submit(true)}
        />
      )}
    </>
  );
}

function ConflictDialog({
  currentName,
  lines,
  nextName,
  busy,
  onKeep,
  onReplace,
}: {
  currentName?: string;
  lines: number;
  nextName: string;
  busy: boolean;
  onKeep: () => void;
  onReplace: () => void;
}) {
  const titleId = useId();
  return (
    <Modal onClose={onKeep} labelledBy={titleId} size="sm">
      <div className="sv-modal-body" style={{ padding: 22 }}>
        <h2 id={titleId} className="sv-modal-title" style={{ fontSize: 19 }}>
          Start a new cart?
        </h2>
        <p style={{ color: 'var(--fg-2)' }}>
          Your cart already has {lines > 0 ? `${lines} ${lines === 1 ? 'item' : 'items'}` : 'items'} from{' '}
          <strong style={{ color: 'var(--fg)' }}>{currentName ?? 'another restaurant'}</strong>. A cart can only hold one
          restaurant's food, so adding from <strong style={{ color: 'var(--fg)' }}>{nextName}</strong> will empty it first.
        </p>
      </div>
      <div className="sv-modal-foot">
        <Button variant="ghost" onClick={onKeep} disabled={busy}>
          Keep my cart
        </Button>
        <Button onClick={onReplace} loading={busy} loadingText="Switching…">
          Start new cart
        </Button>
      </div>
    </Modal>
  );
}
