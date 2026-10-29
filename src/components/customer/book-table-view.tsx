'use client';

import './reservations.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { TextArea } from '@/components/ui/text-area';
import { useToast } from '@/components/ui/toast';
import { MY_RESERVATIONS_KEY, useBookableRestaurants, useSlots } from '@/hooks/use-my-reservations';
import { reservationsApi, type Reservation } from '@/lib/api/reservations';
import { restaurantsApi } from '@/lib/api/restaurants';
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
  const [restaurantId, setRestaurantId] = useState(preset);
  const [party, setParty] = useState(2);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ restaurant?: string; date?: string; slot?: string }>({});
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

  // Changing anything that affects availability clears the chosen time.
  useEffect(() => { setSlot(''); }, [restaurantId, date, party]);
  useEffect(() => { if (slot && slots.data && !slots.data.some((s) => s.time === slot && s.is_available)) setSlot(''); }, [slots.data, slot]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const found: typeof fieldError = {};
    if (!restaurantId) found.restaurant = 'Choose a restaurant';
    if (!date) found.date = 'Choose a date';
    else if (date < minDate || date > maxDate) found.date = `Choose a date within the next ${MAX_ADVANCE_DAYS} days`;
    if (!slot && restaurantId && date) found.slot = 'Pick a time';
    setFieldError(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .rv-slots')?.focus?.());
      return;
    }
    setBusy(true);
    try {
      const saved = await reservationsApi.create({ restaurant: restaurantId, reservation_time: slot, party_size: party, special_requests: note.trim() || undefined });
      void qc.invalidateQueries({ queryKey: MY_RESERVATIONS_KEY });
      push('Booking request sent');
      setDone(saved);
    } catch (err) {
      const pe = parseError(err);
      setError(pe.fieldErrors.reservation_time || pe.fieldErrors.party_size || pe.fieldErrors.restaurant || pe.display);
      // The time may have just been taken, so refresh what is free.
      void qc.invalidateQueries({ queryKey: ['reservation-slots'] });
      if (pe.fieldErrors.reservation_time) setSlot('');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const when = new Date(done.reservation_time);
    return (
      <div className="card sv-acct-card rv-done" role="status">
        <div className="emoji" aria-hidden="true">🎉</div>
        <h1 style={{ margin: 0 }}>Request sent</h1>
        <p style={{ margin: 0, color: 'var(--fg-2)' }}>
          Table for {done.party_size} at <strong>{done.restaurant_name ?? picked?.name ?? 'the restaurant'}</strong><br />
          {when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {clock(when.getTime())}
        </p>
        <p style={{ margin: 0, color: 'var(--fg-3)', fontSize: 14 }}>The restaurant will confirm it soon. You can follow it on your reservations page.</p>
        <div className="sv-acct-actions" style={{ justifyContent: 'center' }}>
          <Link href="/customer/reservations" className="btn btn-primary">View my reservations</Link>
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
                  <button key={s.time} type="button" className="rv-slot" aria-pressed={slot === s.time} disabled={!s.is_available} title={s.is_available ? undefined : s.reason || 'Not available'}
                    onClick={() => { setSlot(s.time); setFieldError((x) => ({ ...x, slot: undefined })); }}>
                    {clock(new Date(s.time).getTime())}
                  </button>
                ))}
              </div>
              {closedReason && <p className="field-hint">{closedReason} Try another day{party > 4 ? ' or a smaller group' : ''}.</p>}
            </>
          )}
          {fieldError.slot && <p className="field-error" role="alert">{fieldError.slot}</p>}
        </div>

        <TextArea label="Special requests (optional)" rows={3} value={note} maxLength={NOTE_MAX} counter placeholder="Allergies, a birthday, a high chair, a quiet corner…" onChange={(e) => setNote(e.target.value)} />

        {summaryTime && picked && (
          <div className="rv-summary" aria-live="polite">
            Table for {party} at {picked.name} on {summaryTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {clock(summaryTime.getTime())}
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
