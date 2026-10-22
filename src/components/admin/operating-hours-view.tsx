'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryGate, SaveBar, SettingsFrame, mapSaveError } from './settings-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { useRestaurantSettings, useSaveSettings, useUnsavedWarning } from '@/hooks/use-restaurant-settings';
import { restaurantSettingsApi, toHHMM, type Holiday, type RestaurantSettings } from '@/lib/api/restaurant-settings';
import { dayKey } from '@/lib/dashboard-stats';
import { parseError } from '@/lib/errors';

function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function lengthOfDay(open: string, close: string): string {
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const mins = ch * 60 + cm - (oh * 60 + om);
  if (!(mins > 0)) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} min` : ''}`;
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/* ───────────── Daily hours + open switch ───────────── */

function HoursForm({ s }: { s: RestaurantSettings }) {
  const { push } = useToast();
  const save = useSaveSettings();
  const base = { open: toHHMM(s.opening_time), close: toHHMM(s.closing_time), isOpen: s.is_open };
  const [v, setV] = useState(base);
  const [errors, setErrors] = useState<{ open?: string; close?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const dirty = v.open !== base.open || v.close !== base.close || v.isOpen !== base.isOpen;
  useUnsavedWarning(dirty);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    if (!v.open) found.open = 'Choose an opening time';
    if (!v.close) found.close = 'Choose a closing time';
    // The server doesn't check this, so we do.
    if (v.open && v.close && v.close <= v.open) found.close = 'Closing time must be after opening time';
    setErrors(found);
    if (found.open || found.close) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const patch: Record<string, string | boolean> = {};
    if (v.open !== base.open) patch.opening_time = v.open;
    if (v.close !== base.close) patch.closing_time = v.close;
    if (v.isOpen !== base.isOpen) patch.is_open = v.isOpen;
    try {
      await save.mutateAsync(patch);
      push('Operating hours saved');
    } catch (err) {
      const m = mapSaveError(err, ['opening_time', 'closing_time']);
      setErrors({ open: m.fields.opening_time, close: m.fields.closing_time });
      setFormError(m.form);
    }
  }

  const len = v.open && v.close ? lengthOfDay(v.open, v.close) : '';
  return (
    <form onSubmit={submit} noValidate className="ad-stack">
      <section className="card ad-card-pad" aria-labelledby="oh-daily">
        <h2 id="oh-daily" className="ad-card-title">Daily hours</h2>
        <p className="ad-note">The same hours apply every day of the week.</p>
        <div className="ad-two">
          <TextField label="Opens at" type="time" value={v.open} onChange={(e) => { setV({ ...v, open: e.target.value }); setErrors((x) => ({ ...x, open: undefined })); }} error={errors.open} />
          <TextField label="Closes at" type="time" value={v.close} onChange={(e) => { setV({ ...v, close: e.target.value }); setErrors((x) => ({ ...x, close: undefined })); }} error={errors.close} />
        </div>
        {v.open && v.close && !errors.open && !errors.close && len && (
          <p className="ad-summary" role="status">Guests see you as open {formatClock(v.open)} to {formatClock(v.close)} ({len}).</p>
        )}
      </section>

      <section className="card ad-card-pad" aria-labelledby="oh-open">
        <h2 id="oh-open" className="ad-card-title">Taking orders</h2>
        <Switch
          label="Open for business"
          description="Turn this off to pause your restaurant, for example when the kitchen is overwhelmed."
          checked={v.isOpen}
          onChange={(isOpen) => setV({ ...v, isOpen })}
        />
      </section>

      <SaveBar dirty={dirty} busy={save.isPending} error={formError} onDiscard={() => { setV(base); setErrors({}); setFormError(null); }} />
    </form>
  );
}

/* ───────────── Holidays ───────────── */

const HOLIDAYS_KEY = ['restaurant-holidays'] as const;

function Holidays() {
  const { push } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: HOLIDAYS_KEY, queryFn: restaurantSettingsApi.holidays, retry: false });
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ date?: string; reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Holiday | null>(null);
  const [showPast, setShowPast] = useState(false);
  const today = dayKey(new Date());

  const add = useMutation({
    mutationFn: () => restaurantSettingsApi.addHoliday(date, reason),
    onSuccess: (h) => {
      qc.setQueryData<Holiday[]>(HOLIDAYS_KEY, (old) => [...(old ?? []), h].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => restaurantSettingsApi.removeHoliday(id),
    onSuccess: (_, id) => qc.setQueryData<Holiday[]>(HOLIDAYS_KEY, (old) => (old ?? []).filter((h) => h.id !== id)),
  });

  const { upcoming, past } = useMemo(() => {
    const all = q.data ?? [];
    return { upcoming: all.filter((h) => h.holiday_date >= today), past: all.filter((h) => h.holiday_date < today).reverse() };
  }, [q.data, today]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    if (!date) found.date = 'Choose the date you will be closed';
    else if (date < today) found.date = 'Choose today or a future date';
    else if ((q.data ?? []).some((h) => h.holiday_date === date)) found.date = 'You already have a closure on that date';
    if (reason.length > 200) found.reason = 'Keep the reason under 200 characters';
    setErrors(found);
    if (found.date || found.reason) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    try {
      await add.mutateAsync();
      push('Closure added');
      setDate('');
      setReason('');
    } catch (err) {
      const m = mapSaveError(err, ['holiday_date', 'reason']);
      setErrors({ date: m.fields.holiday_date, reason: m.fields.reason });
      setFormError(m.form);
    }
  }

  async function confirmRemove() {
    if (!toRemove) return;
    try {
      await remove.mutateAsync(toRemove.id);
      push('Closure removed');
      setToRemove(null);
    } catch (err) {
      setToRemove(null);
      push(parseError(err).display, 'error');
    }
  }

  const Row = ({ h, dim }: { h: Holiday; dim?: boolean }) => (
    <li className={dim ? 'is-past' : ''}>
      <div className="ad-list-icon" aria-hidden="true">🗓️</div>
      <div className="ad-list-main">
        <div className="ad-list-title">{formatDate(h.holiday_date)}{h.holiday_date === today && <span className="badge badge-warn" style={{ marginLeft: 8 }}>Today</span>}</div>
        <div className="ad-list-sub">{h.reason || 'No reason given'}</div>
      </div>
      <button type="button" className="ad-link danger" onClick={() => setToRemove(h)} aria-label={`Remove closure on ${formatDate(h.holiday_date)}`}>Remove</button>
    </li>
  );

  return (
    <section className="card ad-card-pad" aria-labelledby="oh-holidays">
      <h2 id="oh-holidays" className="ad-card-title">Days closed</h2>
      <p className="ad-note">Holidays and other one-off closures.</p>

      <form onSubmit={submit} noValidate className="ad-inline-form">
        {formError && <Alert>{formError}</Alert>}
        <div className="ad-two">
          <TextField label="Date" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: undefined })); }} error={errors.date} />
          <TextField label="Reason" optional value={reason} maxLength={200} placeholder="e.g. Eid holiday" onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })); }} error={errors.reason} />
        </div>
        <div className="ad-actions"><Button type="submit" variant="ghost" loading={add.isPending} loadingText="Adding…">Add closure</Button></div>
      </form>

      {q.isPending && <div className="ad-skel" style={{ height: 60 }} aria-busy="true" aria-label="Loading" />}
      {q.isError && (
        <Alert>
          Couldn&apos;t load your closures: {parseError(q.error).display}{' '}
          <button type="button" className="ad-link" onClick={() => q.refetch()}>Try again</button>
        </Alert>
      )}
      {q.data && (
        <>
          {upcoming.length === 0 ? (
            <p className="ad-note">No upcoming closures. You&apos;re open every day.</p>
          ) : (
            <ul className="ad-list ad-list-flush" aria-label="Upcoming closures">{upcoming.map((h) => <Row key={h.id} h={h} />)}</ul>
          )}
          {past.length > 0 && (
            <>
              <button type="button" className="ad-link" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}>
                {showPast ? 'Hide' : 'Show'} past closures ({past.length})
              </button>
              {showPast && <ul className="ad-list ad-list-flush" aria-label="Past closures">{past.map((h) => <Row key={h.id} h={h} dim />)}</ul>}
            </>
          )}
        </>
      )}

      {toRemove && (
        <ConfirmDialog
          title="Remove this closure?"
          message={`${formatDate(toRemove.holiday_date)}${toRemove.reason ? ` (${toRemove.reason})` : ''} will no longer be marked as closed.`}
          confirmLabel="Remove"
          busy={remove.isPending}
          onClose={() => !remove.isPending && setToRemove(null)}
          onConfirm={confirmRemove}
        />
      )}
    </section>
  );
}

export function OperatingHoursView() {
  const q = useRestaurantSettings();
  return (
    <SettingsFrame active="hours">
      <QueryGate query={q}>{(s) => <><HoursForm s={s} /><Holidays /></>}</QueryGate>
    </SettingsFrame>
  );
}
