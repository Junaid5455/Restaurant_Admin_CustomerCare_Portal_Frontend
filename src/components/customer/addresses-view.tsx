'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountShell, SectionSkeleton } from './account-shell';
import { ADDRESSES_KEY, AddressFormModal, formatAddress } from './address-picker';
import { ConfirmDialog } from './cart-line';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { addressesApi, type SavedAddress } from '@/lib/api/addresses';
import { parseError } from '@/lib/errors';

export function AddressesView() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const addresses = useQuery({ queryKey: ADDRESSES_KEY, queryFn: addressesApi.list });
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = addresses.data ?? [];

  async function makeDefault(a: SavedAddress) {
    setBusyId(a.id);
    setError(null);
    try {
      await addressesApi.setDefault(a.id);
      push(`“${a.label}” is now your default address`);
    } catch (e) {
      setError(parseError(e).display);
    } finally {
      await queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    setError(null);
    try {
      await addressesApi.remove(deleting.id);
      push(`Deleted “${deleting.label}”`, 'info');
    } catch (e) {
      setError(parseError(e).display);
    } finally {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
      setBusyId(null);
    }
  }

  return (
    <AccountShell
      active="addresses"
      title="Saved addresses"
      description="Where should we deliver? Pick one of these at checkout."
      actions={list.length > 0 ? <Button onClick={() => setEditing('new')}>+ Add address</Button> : undefined}
    >
      {error && <Alert>{error}</Alert>}

      {addresses.isPending ? (
        <SectionSkeleton rows={2} />
      ) : addresses.isError ? (
        <div className="sv-acct-inline">
          <Alert>{parseError(addresses.error).display}</Alert>
          <Button variant="ghost" onClick={() => addresses.refetch()}>Try again</Button>
        </div>
      ) : list.length === 0 ? (
        <div className="sv-state">
          <div className="emoji" aria-hidden="true">📍</div>
          <h2>No saved addresses</h2>
          <p>Save your home or work address once and check out faster.</p>
          <Button onClick={() => setEditing('new')}>Add your first address</Button>
        </div>
      ) : (
        <ul className="sv-acct-list sv-acct-cards">
          {list.map((a) => (
            <li key={a.id} className={`card sv-acct-item ${a.is_default ? 'is-default' : ''}`}>
              <div className="sv-acct-item-top">
                <h2>{a.label}</h2>
                {a.is_default && <span className="badge badge-accent">Default</span>}
              </div>
              <p className="sv-acct-item-text">{formatAddress(a)}</p>
              <div className="sv-acct-item-actions">
                <button type="button" className="sv-link-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.label}`}>Edit</button>
                {!a.is_default && (
                  <button type="button" className="sv-link-btn" disabled={busyId === a.id} onClick={() => makeDefault(a)} aria-label={`Make ${a.label} the default address`}>
                    {busyId === a.id ? 'Saving…' : 'Make default'}
                  </button>
                )}
                <button type="button" className="sv-link-btn danger" disabled={busyId === a.id} onClick={() => setDeleting(a)} aria-label={`Delete ${a.label}`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AddressFormModal
          initial={editing === 'new' ? null : editing}
          isFirst={list.length === 0}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            push(`Saved “${saved.label}”`);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this address?"
          message={`“${deleting.label}” will be removed from your saved addresses.`}
          confirmLabel="Delete"
          busy={busyId === deleting.id}
          onConfirm={confirmDelete}
          onClose={() => busyId !== deleting.id && setDeleting(null)}
        />
      )}
    </AccountShell>
  );
}
