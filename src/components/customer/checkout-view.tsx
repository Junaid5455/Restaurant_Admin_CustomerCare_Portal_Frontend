'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AddressPicker, ADDRESSES_KEY, formatAddress } from './address-picker';
import { CheckoutSteps } from './checkout-steps';
import { OrderSummary } from './order-summary';
import { lineDetails } from './cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { CART_KEY, useCart } from '@/hooks/use-cart';
import { addressesApi } from '@/lib/api/addresses';
import { readAppPrefs } from '@/lib/app-prefs';
import { cartApi, type Cart, type CheckoutInput, type OrderType } from '@/lib/api/cart';
import { restaurantsApi, type RestaurantDetail } from '@/lib/api/restaurants';
import { saveSnapshot } from '@/lib/checkout-session';
import { ApiError, parseError } from '@/lib/errors';
import { formatMoney, isOpenNow, toNumber } from '@/lib/format';
import { pickupSlots } from '@/lib/pickup';

const TYPES: { key: OrderType; icon: string; title: string; desc: string; allowed: (r: RestaurantDetail) => boolean }[] = [
  { key: 'PICKUP', icon: '🥡', title: 'Pickup', desc: 'Collect it at the restaurant', allowed: (r) => r.allows_pickup },
  { key: 'DELIVERY', icon: '🛵', title: 'Delivery', desc: 'Brought to your door', allowed: (r) => r.allows_delivery },
  { key: 'DINE_IN', icon: '🍽', title: 'Dine in', desc: 'Eat at the restaurant', allowed: (r) => r.allows_dine_in },
];

const PREP_MINUTES = 20;

/** True when the restaurant lists delivery zones but none of them covers this postal code. */
function outsideZones(r: RestaurantDetail, postal: string | undefined): boolean {
  const zones = r.delivery_zones.filter((z) => z.is_active && z.postal_codes.trim());
  if (!zones.length || !postal) return false;
  const code = postal.trim().toLowerCase();
  return !zones.some((z) => z.postal_codes.split(/[,\s]+/).some((p) => p.trim().toLowerCase() === code));
}

export function CheckoutView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cart = useCart();

  const restaurantId = cart.data?.restaurant ?? null;
  const restaurant = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => restaurantsApi.get(restaurantId as string),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
  const addresses = useQuery({ queryKey: ADDRESSES_KEY, queryFn: addressesApi.list });

  const [chosenType, setChosenType] = useState<OrderType | null>(() => readAppPrefs().orderType);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [slotValue, setSlotValue] = useState('');
  const [table, setTable] = useState('');
  const [guests, setGuests] = useState(2);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  // Re-roll the pickup slots every minute so a long-open page never offers a time in the past.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const r = restaurant.data;
  const available = useMemo(() => (r ? TYPES.filter((t) => t.allowed(r)) : []), [r]);
  const orderType: OrderType | null = chosenType && available.some((t) => t.key === chosenType) ? chosenType : (available[0]?.key ?? null);

  const slots = useMemo(() => pickupSlots(now, PREP_MINUTES, r?.closing_time), [now, r?.closing_time]);
  const slot = slots.find((s) => s.value === slotValue) ?? slots[0];

  /* ── loading / empty / error guards ── */
  if (placed) {
    return (
      <div className="sv-state" role="status" aria-live="polite">
        <div className="spinner" style={{ width: 28, height: 28 }} aria-hidden="true" />
        <h2>Placing your order…</h2>
      </div>
    );
  }

  if (cart.isPending || (restaurantId && restaurant.isPending)) {
    return (
      <div aria-busy="true" aria-label="Loading checkout">
        <div className="sv-skel" style={{ height: 34, width: 220, marginBottom: 18 }} />
        <div className="sv-cart-layout">
          <div className="sv-skel" style={{ height: 360 }} />
          <div className="sv-skel" style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  if (cart.isError || restaurant.isError) {
    const err = cart.isError ? cart.error : restaurant.error;
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">⚠️</div>
        <h2>We couldn’t load checkout</h2>
        <p>{parseError(err).display}</p>
        <button type="button" className="btn btn-primary" onClick={() => (cart.isError ? cart.refetch() : restaurant.refetch())}>
          Try again
        </button>
      </div>
    );
  }

  const data = cart.data;
  if (data.items.length === 0 || !r) {
    return (
      <div className="sv-state">
        <div className="emoji" aria-hidden="true">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Add something delicious before checking out.</p>
        <Link href="/customer/restaurants" className="btn btn-primary">Browse restaurants</Link>
      </div>
    );
  }

  const subtotal = toNumber(data.subtotal);
  const tax = toNumber(data.tax_amount);
  const deliveryFee = orderType === 'DELIVERY' ? toNumber(r.delivery_fee) : 0;
  const total = subtotal + tax + deliveryFee;
  const minOrder = toNumber(r.min_order_amount);
  const belowMin = minOrder > 0 && subtotal < minOrder;
  const closed = !isOpenNow(r);
  const selectedAddress = addresses.data?.find((a) => a.id === addressId);
  const farAway = orderType === 'DELIVERY' && outsideZones(r, selectedAddress?.postal_code);

  async function place() {
    if (!orderType || !r) return;
    const next: Record<string, string> = {};
    const payload: CheckoutInput = { order_type: orderType };

    if (orderType === 'DELIVERY') {
      if (!addressId) next.address = 'Choose or add a delivery address';
      else payload.address_id = addressId;
      if (instructions.trim()) payload.delivery_instructions = instructions.trim();
    } else if (orderType === 'PICKUP') {
      if (!slot) next.pickup = 'No pickup times are left today. Try delivery or order again tomorrow.';
      else if (new Date(slot.value).getTime() < Date.now()) next.pickup = 'That time has passed. Pick a new one.';
      else payload.pickup_time = slot.value;
    } else {
      if (!table.trim()) next.table = 'Enter your table number';
      else payload.table_number = table.trim();
      payload.number_of_guests = guests;
    }

    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
      if (next.pickup) setNow(new Date());
      return;
    }

    setSubmitting(true);
    try {
      const result = await cartApi.checkout(payload);
      saveSnapshot(result.order_id, {
        orderType,
        pickupTime: payload.pickup_time,
        tableNumber: payload.table_number,
        guests: payload.number_of_guests,
        address: selectedAddress ? `${selectedAddress.label} · ${formatAddress(selectedAddress)}` : undefined,
        deliveryInstructions: payload.delivery_instructions,
      });
      setPlaced(true);
      // The cart has become an order: show an empty cart right away, then confirm with the server.
      queryClient.setQueryData<Cart>(CART_KEY, (c) =>
        c ? { ...c, items: [], restaurant: null, subtotal: '0.00', tax_amount: '0.00', delivery_fee: '0.00', total_amount: '0.00' } : c,
      );
      router.push(`/customer/checkout/payment/${result.order_id}`);
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
    } catch (e) {
      const err = e instanceof ApiError ? e : parseError(e);
      const mapped: Record<string, string> = {};
      if (err.fieldErrors.address_id) mapped.address = err.fieldErrors.address_id;
      if (err.fieldErrors.pickup_time) mapped.pickup = err.fieldErrors.pickup_time;
      if (err.fieldErrors.table_number) mapped.table = err.fieldErrors.table_number;
      setErrors(mapped);
      if (!Object.keys(mapped).length || err.formErrors.length) setFormError(err.display);
      // The cart may have changed under us (e.g. emptied in another tab).
      void queryClient.invalidateQueries({ queryKey: CART_KEY });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <CheckoutSteps current={1} />

      <div className="sv-page-head" style={{ marginTop: 18 }}>
        <h1>Checkout</h1>
        <p>
          Ordering from <Link href={`/customer/restaurants/${r.id}`} className="link">{r.name}</Link> ·{' '}
          <Link href="/customer/cart" className="link">Edit cart</Link>
        </p>
      </div>

      {closed && (
        <div style={{ marginBottom: 14 }}>
          <Alert kind="info">{r.name} looks closed right now. You can still place the order, but it may not be prepared until they open.</Alert>
        </div>
      )}

      <div className="sv-cart-layout">
        <div className="sv-checkout-main">
          {/* 1 · Order type */}
          <section className="card sv-sec" aria-labelledby="ot-h">
            <h2 id="ot-h"><span className="n">1</span> How would you like your order?</h2>
            {available.length === 0 ? (
              <Alert>{r.name} isn’t accepting pickup, delivery or dine-in orders right now.</Alert>
            ) : (
              <div className="sv-types" role="radiogroup" aria-labelledby="ot-h">
                {available.map((t) => (
                  <label key={t.key} className={`sv-type ${orderType === t.key ? 'selected' : ''}`}>
                    <input type="radio" name="order-type" value={t.key} checked={orderType === t.key} onChange={() => { setChosenType(t.key); setErrors({}); setFormError(null); }} />
                    <span className="icon" aria-hidden="true">{t.icon}</span>
                    <span className="title">{t.title}</span>
                    <span className="desc">
                      {t.key === 'DELIVERY' ? (toNumber(r.delivery_fee) > 0 ? `${formatMoney(r.delivery_fee)} delivery fee` : 'Free delivery') : t.desc}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* 2 · Details for the chosen type */}
          {orderType === 'DELIVERY' && (
            <section className="card sv-sec" aria-labelledby="dl-h">
              <h2 id="dl-h"><span className="n">2</span> Delivery address</h2>
              <AddressPicker selectedId={addressId} onSelect={setAddressId} error={errors.address} />
              {farAway && (
                <div style={{ marginTop: 12 }}>
                  <Alert kind="info">
                    This address’s postal code isn’t in {r.name}’s listed delivery areas. The restaurant may decline the order.
                  </Alert>
                </div>
              )}
              <div className="field" style={{ marginTop: 16 }}>
                <label className="field-label" htmlFor="delivery-notes">Delivery instructions <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>(optional)</span></label>
                <textarea id="delivery-notes" className="sv-textarea" maxLength={300} placeholder="Gate code, landmark, leave at the door…" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
              </div>
            </section>
          )}

          {orderType === 'PICKUP' && (
            <section className="card sv-sec" aria-labelledby="pk-h">
              <h2 id="pk-h"><span className="n">2</span> Pickup time</h2>
              {slots.length === 0 ? (
                <Alert kind="info">There are no pickup times left today{r.closing_time ? ` (they close at ${r.closing_time.slice(0, 5)})` : ''}. Choose delivery or order again tomorrow.</Alert>
              ) : (
                <div className="field">
                  <label className="field-label" htmlFor="pickup-slot">When will you collect it?</label>
                  <select id="pickup-slot" className="sv-select" value={slot?.value ?? ''} onChange={(e) => setSlotValue(e.target.value)} aria-invalid={errors.pickup ? true : undefined}>
                    {slots.map((s, i) => (
                      <option key={s.value} value={s.value}>{i === 0 ? `As soon as possible · ${s.label}` : s.label}</option>
                    ))}
                  </select>
                  <p className="field-hint">Ready in about {PREP_MINUTES} minutes. Pickup is at {r.address}.</p>
                </div>
              )}
              {errors.pickup && <p className="field-error" role="alert" style={{ marginTop: 8 }}>{errors.pickup}</p>}
            </section>
          )}

          {orderType === 'DINE_IN' && (
            <section className="card sv-sec" aria-labelledby="di-h">
              <h2 id="di-h"><span className="n">2</span> Your table</h2>
              <div className="sv-two">
                <TextField label="Table number" maxLength={10} value={table} onChange={(e) => setTable(e.target.value)} error={errors.table} hint="Printed on your table" autoComplete="off" />
                <div className="field">
                  <span className="field-label" id="guests-l">Guests</span>
                  <div className="sv-qty" role="group" aria-labelledby="guests-l" style={{ alignSelf: 'flex-start' }}>
                    <button type="button" aria-label="Fewer guests" disabled={guests <= 1} onClick={() => setGuests((g) => g - 1)}>−</button>
                    <output aria-live="polite">{guests}</output>
                    <button type="button" aria-label="More guests" disabled={guests >= 20} onClick={() => setGuests((g) => g + 1)}>+</button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Summary */}
        <aside className="sv-cart-aside">
          <OrderSummary subtotal={subtotal} tax={tax} deliveryFee={orderType === 'DELIVERY' ? deliveryFee : 0} total={total}>
            <ul className="sv-mini-lines">
              {data.items.map((line) => (
                <li key={line.id}>
                  <span className="q">{line.quantity}×</span>
                  <span className="n">
                    {line.item_name}
                    {lineDetails(line).length > 0 && <small>{lineDetails(line).join(' · ')}</small>}
                  </span>
                  <span className="p">{formatMoney(line.subtotal)}</span>
                </li>
              ))}
            </ul>
          </OrderSummary>

          {belowMin && (
            <Alert kind="info">{r.name} has a minimum order of {formatMoney(minOrder)}. <Link href="/customer/cart" className="link">Add more items</Link> to continue.</Alert>
          )}
          {formError && <Alert>{formError}</Alert>}

          <Button block loading={submitting} loadingText="Placing order…" disabled={belowMin || !orderType} onClick={place}>
            Place order · {formatMoney(total)}
          </Button>
          <p className="sv-fineprint">You’ll choose how to pay on the next step.</p>
        </aside>
      </div>
    </div>
  );
}
