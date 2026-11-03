'use client';

import './reservations.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookingMenu } from './booking-menu';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { useCart } from '@/hooks/use-cart';
import { MY_RESERVATIONS_KEY, useBookableRestaurants, useSlots, useTableOptions } from '@/hooks/use-my-reservations';
import { reservationsApi, type Reservation } from '@/lib/api/reservations';
import { restaurantsApi } from '@/lib/api/restaurants';
import { dineInHref, saveDineIn } from '@/lib/dine-in';
import { parseError } from '@/lib/errors';
import { MAX_ADVANCE_DAYS, NOTE_MAX, PARTY_MAX, isoDay } from '@/lib/my-reservations';
import { clock } from '@/lib/reservations';

export function BookTableView() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { push } = useToast();
  const preset = params.get('restaurant') ?? '';

  const list = useBookableRestaurants();
  const cart = useCart();
  const [restaurantId, setRestaurantId] = useState(preset);
  const [party, setParty] = useState(2);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [custom, setCustom] = useState(''); // HH:MM typed by the guest
  const [tableId, setTableId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ restaurant?: string; date?: string; slot?: string; table?: string }>({});
  const [done, setDone] = useState<Reservation | null>(null);

  const today = useMemo(() => new Date(), []);
  const minDate = isoDay(today);
  const maxDate = isoDay(new Date(today.getTime() + MAX_ADVANCE_DAYS * 86_400_000));

  // A restaurant linked from its page may not be on the first page of the list, so look it up on its own.
  const presetQ = useQuery({ queryKey: ['restaurant', preset], queryFn: () => restaurantsApi.get(preset), enabled: !!preset, retry: false });
  const restaurants = useMemo(() => {
    const rows = (list.data ?? []).map((r) => ({ id: r.id, name: r.name }));
    if (presetQ.data && !rows.some((r) => r.id === presetQ.data.id)) rows.unshift({ id: presetQ.data.id, name: presetQ.data.name });
    return rows;
  }, [list.data, presetQ.data]);
  const picked = restaurants.find((r) => r.id === restaurantId);

  const slots = useSlots(restaurantId, date, party);
  const open = (slots.data ?? []).filter((s) => s.is_available);
  const closedReason = slots.data && slots.data.length > 0 && open.length === 0 ? slots.data.find((s) => s.reason)?.reason : undefined;

  // The tables at the chosen time, each marked free or taken. Only shown once a time is chosen.
  const tablesQ = useTableOptions(restaurantId, slot, party);
  const tableRows = useMemo(() => [...(tablesQ.data ?? [])].sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true, sensitivity: 'base' })), [tablesQ.data]);
  const pickedTable = tableRows.find((t) => t.id === tableId);

  // Changing anything that affects availability clears the chosen time.
  useEffect(() => { setSlot(''); setCustom(''); }, [restaurantId, date, party]);
  // A different time means a different set of free tables.
  useEffect(() => { setTableId(''); }, [restaurantId, date, party, slot]);
  // If the chosen table gets taken by someone else while the guest is still filling in the form, say so.
  useEffect(() => {
    if (tableId && tablesQ.data && !tablesQ.data.some((t) => t.id === tableId && t.is_available)) {
      setTableId('');
      setFieldError((x) => ({ ...x, table: 'That table was just taken by someone else. Please pick another.' }));
    }
  }, [tablesQ.data, tableId]);
  useEffect(() => { if (slot && !custom && slots.data && !slots.data.some((s) => s.time === slot && s.is_available)) setSlot(''); }, [slots.data, slot, custom]);

  // Any time the guest likes, not just the listed hours. The server still checks opening hours and availability.
  function pickCustom(value: string) {
    setCustom(value);
    setFieldError((x) => ({ ...x, slot: undefined }));
    if (!value || !date) { setSlot(''); return; }
    const d = new Date(`${date}T${value}`);
    setSlot(Number.isNaN(d.getTime()) ? '' : d.toISOString());
  }
  const listed = (slots.data ?? []).map((x) => new Date(x.time).getTime());
  const hoursHint = listed.length ? `${clock(Math.min(...listed))} to about ${clock(Math.max(...listed) + 3_600_000)}` : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const found: typeof fieldError = {};
    if (!restaurantId) found.restaurant = 'Choose a restaurant';
    if (!date) found.date = 'Choose a date';
    else if (date < minDate || date > maxDate) found.date = `Choose a date within the next ${MAX_ADVANCE_DAYS} days`;
    if (!slot && restaurantId && date) found.slot = 'Pick a time';
    if (slot && tablesQ.isPending) found.table = 'Loading the tables. Try again in a moment.';
    else if (slot && tablesQ.isSuccess && tableRows.length > 0 && !tableId) found.table = 'Choose a table';
    setFieldError(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .rv-slots')?.focus?.());
      return;
    }
    setBusy(true);
    try {
      const saved = await reservationsApi.create({ restaurant: restaurantId, reservation_time: slot, party_size: party, table: tableId || undefined, special_requests: note.trim() || undefined });
      void qc.invalidateQueries({ queryKey: MY_RESERVATIONS_KEY });
      push('Booking request sent');
      // Remember the table so the cart and checkout can start on "dine in" with it filled in.
      saveDineIn({ restaurant: restaurantId, table: saved.table_number ?? '', guests: saved.party_size, when: saved.reservation_time });
      setDone(saved);
    } catch (err) {
      const pe = parseError(err);
      setError(pe.fieldErrors.table || pe.fieldErrors.reservation_time || pe.fieldErrors.party_size || pe.fieldErrors.restaurant || pe.display);
      // The time may have just been taken, so refresh what is free.
      void qc.invalidateQueries({ queryKey: ['reservation-slots'] });
      void qc.invalidateQueries({ queryKey: ['reservation-tables'] });
      if (pe.fieldErrors.table) setTableId('');
      if (pe.fieldErrors.reservation_time) setSlot('');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const when = new Date(done.reservation_time);
    const food = cart.data && cart.data.restaurant === (done.restaurant || restaurantId) ? cart.data : null;
    const foodCount = food ? food.items.reduce((n, l) => n + l.quantity, 0) : 0;
    return (
      <div className="card sv-acct-card rv-done" role="status">
        <div className="emoji" aria-hidden="true">🎉</div>
        <h1 style={{ margin: 0 }}>Request sent</h1>
        <p style={{ margin: 0, color: 'var(--fg-2)' }}>
          Table for {done.party_size} at <strong>{done.restaurant_name ?? picked?.name ?? 'the restaurant'}</strong><br />
          {when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {clock(when.getTime())}
        </p>
        <p style={{ margin: 0, color: 'var(--fg-3)', fontSize: 14 }}>The restaurant will confirm it soon. You can follow it on your reservations page.{foodCount > 0 && ' Your chosen dishes are waiting in your cart. Place the order when you are about to arrive.'}</p>
        <div className="sv-acct-actions" style={{ justifyContent: 'center' }}>
          {foodCount > 0 ? (
            <Link href="/customer/cart" className="btn btn-primary">🍽 Review your food order ({foodCount} {foodCount === 1 ? 'item' : 'items'})</Link>
          ) : (
            <Link href={dineInHref({ restaurant: done.restaurant || restaurantId, table_number: done.table_number, party_size: done.party_size, reservation_time: done.reservation_time })} className="btn btn-primary">🍽 Order food for your table</Link>
          )}
          <Link href="/customer/reservations" className="btn btn-ghost">View my reservations</Link>
          <Button variant="ghost" onClick={() => { setDone(null); setDate(''); setNote(''); }}>Book another</Button>
        </div>
      </div>
    );
  }

  const summaryTime = slot ? new Date(slot) : null;

  return (
    <>
      <Link href="/customer/reservations" className="sv-back">← My reservations</Link>
      <div className="sv-page-head" style={{ marginTop: 10 }}>
        <h1>Book a table</h1>
        <p>Choose a restaurant, a day and a time. The restaurant confirms your request.</p>
      </div>

      <form className="card sv-acct-card rv-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="rv-restaurant">Restaurant</label>
          <select id="rv-restaurant" className={`input sv-select-input ${fieldError.restaurant ? 'input-error' : ''}`} value={restaurantId} aria-invalid={fieldError.restaurant ? true : undefined}
            onChange={(e) => { setRestaurantId(e.target.value); setFieldError((x) => ({ ...x, restaurant: undefined })); }} disabled={list.isPending && !restaurants.length}>
            <option value="">{list.isPending ? 'Loading restaurants…' : 'Choose a restaurant…'}</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {fieldError.restaurant && <p className="field-error" role="alert">{fieldError.restaurant}</p>}
          {list.isError && !restaurants.length && <p className="field-hint">We couldn’t load restaurants. <button type="button" className="sv-link-btn" onClick={() => void list.refetch()}>Try again</button></p>}
        </div>

        {restaurantId && <BookingMenu key={restaurantId} restaurantId={restaurantId} name={picked?.name ?? 'this restaurant'} />}

        <div className="rv-row">
          <div className="field">
            <span className="field-label" id="rv-party-label">Guests</span>
            <div className="rv-step" role="group" aria-labelledby="rv-party-label">
              <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} disabled={party <= 1} aria-label="Fewer guests">−</button>
              <output aria-live="polite" aria-label={`${party} guests`}>{party}</output>
              <button type="button" onClick={() => setParty((p) => Math.min(PARTY_MAX, p + 1))} disabled={party >= PARTY_MAX} aria-label="More guests">+</button>
            </div>
            {party >= PARTY_MAX && <p className="field-hint">For larger groups please call the restaurant.</p>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="rv-date">Date</label>
            <input id="rv-date" type="date" className={`input ${fieldError.date ? 'input-error' : ''}`} min={minDate} max={maxDate} value={date} aria-invalid={fieldError.date ? true : undefined}
              onChange={(e) => { setDate(e.target.value); setFieldError((x) => ({ ...x, date: undefined })); }} />
            {fieldError.date && <p className="field-error" role="alert">{fieldError.date}</p>}
          </div>
        </div>

        <div className="field">
          <span className="field-label" id="rv-time-label">Time</span>
          {!restaurantId || !date ? (
            <p className="field-hint">Choose a restaurant and a date to see the times that are free.</p>
          ) : slots.isPending ? (
            <div className="rv-slots" aria-busy="true" aria-label="Loading times">{Array.from({ length: 8 }, (_, i) => <div key={i} className="sv-skel" style={{ height: 42, borderRadius: 12 }} />)}</div>
          ) : slots.isError ? (
            <div className="sv-acct-inline"><Alert>{parseError(slots.error).display}</Alert><Button variant="ghost" onClick={() => void slots.refetch()}>Try again</Button></div>
          ) : (slots.data ?? []).length === 0 ? (
            <p className="field-hint">This restaurant has no bookable times on that day.</p>
          ) : (
            <>
              <div className="rv-slots" role="group" aria-labelledby="rv-time-label" tabIndex={-1}>
                {(slots.data ?? []).map((s) => (
                  <button key={s.time} type="button" className="rv-slot" aria-pressed={!custom && slot === s.time} disabled={!s.is_available} title={s.is_available ? undefined : s.reason || 'Not available'}
                    onClick={() => { setCustom(''); setSlot(s.time); setFieldError((x) => ({ ...x, slot: undefined })); }}>
                    {clock(new Date(s.time).getTime())}
                  </button>
                ))}
              </div>
              <div className="rv-custom">
                <label htmlFor="rv-custom-time" className="field-label">Or choose your own time</label>
                <input id="rv-custom-time" type="time" className="input" value={custom} onChange={(e) => pickCustom(e.target.value)} aria-describedby="rv-custom-hint" />
                <p className="field-hint" id="rv-custom-hint">Any minute works, for example 7:45 PM.{hoursHint ? ` The restaurant is open ${hoursHint}.` : ''}</p>
              </div>
              {closedReason && <p className="field-hint">{closedReason} Try another day{party > 4 ? ' or a smaller group' : ''}.</p>}
            </>
          )}
          {fieldError.slot && <p className="field-error" role="alert">{fieldError.slot}</p>}
        </div>

        {slot && (
          <div className="field">
            <span className="field-label" id="rv-table-label">Table</span>
            {tablesQ.isPending ? (
              <div className="rv-tables" aria-busy="true" aria-label="Loading tables">{Array.from({ length: 4 }, (_, i) => <div key={i} className="sv-skel" style={{ height: 78, borderRadius: 14 }} />)}</div>
            ) : tablesQ.isError ? (
              <div className="sv-acct-inline"><Alert>{parseError(tablesQ.error).display}</Alert><Button variant="ghost" onClick={() => void tablesQ.refetch()}>Try again</Button></div>
            ) : tableRows.length === 0 ? (
              <p className="field-hint">This restaurant will choose a table for you.</p>
            ) : (
              <>
                <div className="rv-tables" role="radiogroup" aria-labelledby="rv-table-label">
                  {tableRows.map((t) => {
                    const tooSmall = /too small/i.test(t.reason);
                    return (
                      <button key={t.id} type="button" role="radio" aria-checked={tableId === t.id} className="rv-table" disabled={!t.is_available} title={t.is_available ? undefined : t.reason}
                        onClick={() => { setTableId(t.id); setFieldError((x) => ({ ...x, table: undefined })); }}>
                        <strong>Table {t.table_number}</strong>
                        <span>🪑 Seats {t.capacity}</span>
                        <small>{t.is_available ? (tableId === t.id ? '✓ Selected' : 'Free') : tooSmall ? 'Too small for your group' : 'Booked at this time'}</small>
                      </button>
                    );
                  })}
                </div>
                <p className="field-hint">Greyed-out tables are already booked at this time or too small for your group.</p>
              </>
            )}
            {fieldError.table && <p className="field-error" role="alert">{fieldError.table}</p>}
          </div>
        )}

        <TextArea label="Special requests (optional)" rows={3} value={note} maxLength={NOTE_MAX} counter placeholder="Allergies, a birthday, a high chair, a quiet corner…" onChange={(e) => setNote(e.target.value)} />

        {summaryTime && picked && (
          <div className="rv-summary" aria-live="polite">
            Table for {party} at {picked.name} on {summaryTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {clock(summaryTime.getTime())}{pickedTable ? ` · Table ${pickedTable.table_number}` : ''}
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="sv-acct-actions">
          <Button type="submit" loading={busy} loadingText="Sending…">Request booking</Button>
          <Link href="/customer/reservations" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </>
  );
}
