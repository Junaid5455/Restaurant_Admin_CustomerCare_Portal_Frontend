'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ReservationsFrame } from './reservations-kit';
import { mapSaveError } from './settings-kit';
import { LoadError } from './super-kit';
import { ConfirmDialog } from '@/components/customer/cart-line';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { TABLES_KEY, useTables } from '@/hooks/use-admin-reservations';
import { adminReservationsApi, type DiningTable } from '@/lib/api/admin-reservations';
import { parseError } from '@/lib/errors';
import { byTableNumber, tableSummary } from '@/lib/reservations';

function TableModal({ table, onClose, others }: { table: DiningTable | null; onClose: () => void; others: DiningTable[] }) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [number, setNumber] = useState(table?.table_number ?? '');
  const [seats, setSeats] = useState(table ? String(table.capacity) : '2');
  const [active, setActive] = useState(table?.is_active ?? true);
  const [errors, setErrors] = useState<Partial<Record<'number' | 'seats', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    const n = number.trim();
    if (!n) found.number = 'Give this table a name or number';
    else if (n.length > 20) found.number = 'Keep it under 20 characters';
    else if (others.some((o) => o.table_number.trim().toLowerCase() === n.toLowerCase())) found.number = `You already have a table “${n}”`;
    if (!/^\d+$/.test(seats.trim()) || Number(seats) < 1 || Number(seats) > 50) found.seats = 'Enter whole seats between 1 and 50';
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.sv-modal [aria-invalid="true"]')?.focus());
      return;
    }
    const body = { table_number: n, capacity: Number(seats), is_active: active };
    setBusy(true);
    try {
      const saved = table ? await adminReservationsApi.updateTable(table.id, body) : await adminReservationsApi.addTable(body);
      qc.setQueryData<DiningTable[]>(TABLES_KEY, (old) => [...(old ?? []).filter((t) => t.id !== saved.id), saved].sort(byTableNumber));
      push(table ? 'Table updated' : 'Table added');
      onClose();
    } catch (err) {
      const m = mapSaveError(err, ['table_number', 'capacity']);
      setErrors({ number: m.fields.table_number, seats: m.fields.capacity });
      setFormError(m.form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} labelledBy="table-title">
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body">
            <h2 id="table-title" className="sv-modal-title">{table ? 'Edit table' : 'Add a table'}</h2>
            {formError && <Alert>{formError}</Alert>}
            <div className="ad-two">
              <TextField label="Table name or number" value={number} maxLength={20} placeholder="e.g. 12 or Patio 3" onChange={(e) => { setNumber(e.target.value); setErrors((x) => ({ ...x, number: undefined })); }} error={errors.number} />
              <TextField label="Seats" inputMode="numeric" value={seats} onChange={(e) => { setSeats(e.target.value); setErrors((x) => ({ ...x, seats: undefined })); }} error={errors.seats} />
            </div>
            <Switch label="In use" description="Turn off a table that is out of service. It stays on your list." checked={active} onChange={setActive} />
          </div>
        </div>
        <div className="sv-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <Button type="submit" loading={busy} loadingText="Saving…">{table ? 'Save table' : 'Add table'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function TablesView() {
  const q = useTables();
  const qc = useQueryClient();
  const { push } = useToast();
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null);
  const [toRemove, setToRemove] = useState<DiningTable | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const tables = useMemo(() => [...(q.data ?? [])].sort(byTableNumber), [q.data]);
  const sum = tableSummary(tables);

  async function toggle(t: DiningTable) {
    setBusyId(t.id);
    try {
      const saved = await adminReservationsApi.updateTable(t.id, { is_active: !t.is_active });
      qc.setQueryData<DiningTable[]>(TABLES_KEY, (old) => old?.map((x) => (x.id === t.id ? { ...x, ...saved } : x)));
      push(saved.is_active ? `Table ${t.table_number} is in use` : `Table ${t.table_number} is out of service`);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await adminReservationsApi.removeTable(toRemove.id);
      qc.setQueryData<DiningTable[]>(TABLES_KEY, (old) => old?.filter((x) => x.id !== toRemove.id));
      push(`Table ${toRemove.table_number} deleted`);
      setToRemove(null);
    } catch (e) {
      push(parseError(e).display, 'error');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <ReservationsFrame
      active="tables"
      title="Tables"
      description={q.data ? (tables.length ? `${sum.active} of ${sum.count} tables in use · ${sum.seats} seats` : 'The tables guests can book.') : 'The tables guests can book.'}
      actions={<Button onClick={() => setEditing('new')}>Add a table</Button>}
    >
      {q.isError ? <LoadError query={q} what="tables" /> : q.isPending ? (
        <div className="rs-tables" aria-busy="true" aria-label="Loading tables">{Array.from({ length: 4 }, (_, i) => <div key={i} className="ad-skel" style={{ height: 120, borderRadius: 16 }} />)}</div>
      ) : tables.length === 0 ? (
        <div className="card ad-empty">
          <div className="ad-empty-icon" aria-hidden="true">🪑</div>
          <strong>No tables yet</strong>
          <span>Add the tables in your dining room so guests can reserve them.</span>
          <Button onClick={() => setEditing('new')}>Add your first table</Button>
        </div>
      ) : (
        <ul className="rs-tables">
          {tables.map((t) => (
            <li key={t.id} className={`rs-table ${t.is_active ? '' : 'is-off'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <h3>Table {t.table_number}</h3>
                <span className={`badge ${t.is_active ? 'badge-good' : 'badge-neutral'}`}>{t.is_active ? 'In use' : 'Out of service'}</span>
              </div>
              <div className="rs-seats">🪑 Seats {t.capacity}</div>
              <div className="rs-table-actions">
                <button type="button" className="ad-link" onClick={() => void toggle(t)} disabled={busyId === t.id} aria-label={`${t.is_active ? 'Take out of service' : 'Put back in use'}: table ${t.table_number}`}>{t.is_active ? 'Pause' : 'Resume'}</button>
                <button type="button" className="ad-link" onClick={() => setEditing(t)} aria-label={`Edit table ${t.table_number}`}>Edit</button>
                <button type="button" className="ad-link danger" onClick={() => setToRemove(t)} aria-label={`Delete table ${t.table_number}`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TableModal key={editing === 'new' ? 'new' : editing.id} table={editing === 'new' ? null : editing} others={tables.filter((t) => editing === 'new' || t.id !== editing.id)} onClose={() => setEditing(null)} />
      )}
      {toRemove && (
        <ConfirmDialog
          title={`Delete table ${toRemove.table_number}?`}
          message="Guests will no longer be able to book it. If you only need it out of service for a while, take it out of service instead."
          confirmLabel="Delete table"
          busy={removing}
          onClose={() => !removing && setToRemove(null)}
          onConfirm={() => void remove()}
        />
      )}
    </ReservationsFrame>
  );
}
