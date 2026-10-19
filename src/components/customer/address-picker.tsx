'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from './cart-line';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { addressesApi, type AddressInput, type SavedAddress } from '@/lib/api/addresses';
import { ApiError, parseError } from '@/lib/errors';

export const ADDRESSES_KEY = ['addresses'] as const;

const EMPTY: AddressInput = { label: '', address: '', city: '', state: '', country: '', postal_code: '', is_default: false };

export function formatAddress(a: Pick<SavedAddress, 'address' | 'city' | 'state' | 'country' | 'postal_code'>): string {
  return [a.address, a.city, [a.state, a.postal_code].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ');
}

/* ───────────── Add / edit form ───────────── */

export function AddressFormModal({
  initial,
  isFirst,
  onClose,
  onSaved,
}: {
  initial: SavedAddress | null;
  isFirst: boolean;
  onClose: () => void;
  onSaved: (a: SavedAddress) => void;
}) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<AddressInput>(
    initial
      ? { label: initial.label, address: initial.address, city: initial.city, state: initial.state, country: initial.country, postal_code: initial.postal_code, is_default: initial.is_default }
      : { ...EMPTY, is_default: isFirst },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof AddressInput) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const trimmed = { ...values, label: values.label.trim(), address: values.address.trim(), city: values.city.trim(), state: values.state.trim(), country: values.country.trim(), postal_code: values.postal_code.trim() };
    if (!trimmed.label) next.label = 'Give this address a name, like Home or Work';
    if (!trimmed.address) next.address = 'Enter the street address';
    if (!trimmed.city) next.city = 'Enter the city';
    if (!trimmed.state) next.state = 'Enter the state or province';
    if (!trimmed.country) next.country = 'Enter the country';
    if (!trimmed.postal_code) next.postal_code = 'Enter the postal code';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const saved = initial ? await addressesApi.update(initial.id, trimmed) : await addressesApi.create(trimmed);
      await queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
      onSaved(saved);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : parseError(err);
      setErrors(apiErr.fieldErrors);
      if (!Object.keys(apiErr.fieldErrors).length) setFormError(apiErr.display);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => !busy && onClose()} labelledBy={titleId}>
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="sv-modal-scroll">
          <div className="sv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 26 }}>
            <h2 id={titleId} className="sv-modal-title" style={{ fontSize: 20 }}>{initial ? 'Edit address' : 'Add a delivery address'}</h2>
            <TextField label="Label" placeholder="Home, Work…" maxLength={50} value={values.label} onChange={set('label')} error={errors.label} autoComplete="off" />
            <TextField label="Street address" placeholder="House / flat, street, area" value={values.address} onChange={set('address')} error={errors.address} autoComplete="street-address" />
            <div className="sv-two">
              <TextField label="City" value={values.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
              <TextField label="State / province" value={values.state} onChange={set('state')} error={errors.state} autoComplete="address-level1" />
            </div>
            <div className="sv-two">
              <TextField label="Country" value={values.country} onChange={set('country')} error={errors.country} autoComplete="country-name" />
              <TextField label="Postal code" maxLength={10} value={values.postal_code} onChange={set('postal_code')} error={errors.postal_code} autoComplete="postal-code" />
            </div>
            <label className="sv-check">
              <input type="checkbox" checked={values.is_default} onChange={(e) => setValues((v) => ({ ...v, is_default: e.target.checked }))} />
              Use as my default address
            </label>
            {formError && <Alert>{formError}</Alert>}
          </div>
        </div>
        <div className="sv-modal-foot">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} loadingText="Saving…">Save address</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────── Picker ───────────── */

export function AddressPicker({
  selectedId,
  onSelect,
  error,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  error?: string;
}) {
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: ADDRESSES_KEY, queryFn: addressesApi.list });
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const list = addresses.data ?? [];

  // Keep a valid selection: prefer the default address, then the first one.
  useEffect(() => {
    if (!addresses.data) return;
    if (selectedId && addresses.data.some((a) => a.id === selectedId)) return;
    onSelect((addresses.data.find((a) => a.is_default) ?? addresses.data[0])?.id ?? null);
  }, [addresses.data, selectedId, onSelect]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await addressesApi.remove(deleting.id);
      setDeleting(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    } catch (e) {
      setDeleteError(parseError(e).display);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  if (addresses.isPending) {
    return <div className="sv-skel" style={{ height: 92 }} aria-busy="true" aria-label="Loading your addresses" />;
  }
  if (addresses.isError) {
    return (
      <div>
        <Alert>{parseError(addresses.error).display}</Alert>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => addresses.refetch()}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      {list.length === 0 ? (
        <div className="sv-empty-inline">
          <p>You haven’t saved a delivery address yet.</p>
        </div>
      ) : (
        <div role="radiogroup" aria-label="Delivery address" aria-invalid={error ? true : undefined} className="sv-addr-list">
          {list.map((a) => (
            <div key={a.id} className={`sv-addr ${selectedId === a.id ? 'selected' : ''}`}>
              <label>
                <input type="radio" name="address" value={a.id} checked={selectedId === a.id} onChange={() => onSelect(a.id)} />
                <span className="body">
                  <span className="top">
                    <strong>{a.label}</strong>
                    {a.is_default && <span className="badge badge-accent">Default</span>}
                  </span>
                  <span className="text">{formatAddress(a)}</span>
                </span>
              </label>
              <div className="actions">
                <button type="button" className="sv-link-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.label}`}>Edit</button>
                <button type="button" className="sv-link-btn" onClick={() => setDeleting(a)} aria-label={`Delete ${a.label}`}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="field-error" role="alert" style={{ marginTop: 8 }}>{error}</p>}
      {deleteError && <div style={{ marginTop: 10 }}><Alert>{deleteError}</Alert></div>}

      <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>
        + Add a new address
      </button>

      {editing && (
        <AddressFormModal
          initial={editing === 'new' ? null : editing}
          isFirst={list.length === 0}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            onSelect(saved.id);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this address?"
          message={`“${deleting.label}” will be removed from your saved addresses.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onClose={() => !deleteBusy && setDeleting(null)}
        />
      )}
    </div>
  );
}
