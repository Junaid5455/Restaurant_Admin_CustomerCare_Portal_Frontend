'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SettingsShell } from './settings-shell';
import { ConfirmDialog } from './cart-line';
import { usePrefsQuery } from './settings-notifications-view';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { clearDeviceData } from '@/lib/app-prefs';
import { DEFAULT_PREFS } from '@/lib/api/preferences';

/** Opens the support form with the request already written, so a data request is one tap and fully tracked. */
function requestHref(subject: string, message: string) {
  const q = new URLSearchParams({ category: 'GENERAL_INQUIRY', subject, message });
  return `/customer/support/new?${q.toString()}`;
}

export function SettingsPrivacyView() {
  const { user } = useAuth();
  const { push } = useToast();
  const prefs = usePrefsQuery();
  const [confirmClear, setConfirmClear] = useState(false);

  const p = { ...DEFAULT_PREFS, ...(prefs.data?.record ?? {}) };
  const marketing = [
    { label: 'Email', on: p.email_promotions },
    { label: 'SMS', on: p.sms_promotions },
    { label: 'Push', on: p.push_promotions },
  ];

  const who = user?.email ?? '';
  const copyHref = requestHref(
    'Request a copy of my data',
    `Please send me a copy of the personal data you hold for the account ${who}. I understand you may need to verify my identity first.`,
  );
  const deleteHref = requestHref(
    'Delete my account',
    `Please delete my account ${who} and the personal data linked to it. I understand this can't be undone and that you may need to keep some order records for legal or accounting reasons.`,
  );

  return (
    <SettingsShell active="privacy">
      <section className="card sv-acct-card" aria-labelledby="p-mkt">
        <div className="sv-acct-rowhead">
          <h2 id="p-mkt" className="sv-acct-h">Marketing choices</h2>
          <Link href="/customer/settings/notifications" className="sv-link-btn">Change</Link>
        </div>
        {prefs.isPending ? (
          <div className="sv-skel" style={{ height: 30, width: 260, borderRadius: 999 }} aria-busy="true" aria-label="Loading" />
        ) : prefs.isError ? (
          <p className="sv-acct-note">We couldn&apos;t load your choices right now. You can review them on the Notifications page.</p>
        ) : (
          <ul className="sv-chips" aria-label="Current marketing choices">
            {marketing.map((m) => (
              <li key={m.label} className={`badge ${m.on ? 'badge-good' : 'badge-neutral'}`}>
                {m.label}: {m.on ? 'on' : 'off'}
              </li>
            ))}
          </ul>
        )}
        <p className="sv-acct-note">We only send offers on the channels that are on. Order messages are controlled separately.</p>
      </section>

      <section className="card sv-acct-card" aria-labelledby="p-data">
        <h2 id="p-data" className="sv-acct-h">What we keep about you</h2>
        <ul className="sv-bullets">
          <li><strong>Account:</strong> your name, email, phone number and profile photo. <Link href="/customer/profile" className="sv-link-btn">View or edit</Link></li>
          <li><strong>Addresses:</strong> the delivery addresses you saved. <Link href="/customer/addresses" className="sv-link-btn">Manage</Link></li>
          <li><strong>Orders & rewards:</strong> your order history and loyalty points. <Link href="/customer/orders" className="sv-link-btn">See orders</Link></li>
          <li><strong>Support:</strong> your tickets and messages. <Link href="/customer/support" className="sv-link-btn">Open support</Link></li>
        </ul>
      </section>

      <section className="card sv-acct-card" aria-labelledby="p-req">
        <h2 id="p-req" className="sv-acct-h">Your data, your call</h2>
        <p className="sv-acct-note">
          These requests go to our support team as a ticket, so you can follow progress and reply in one place.
          We may ask you to confirm it&apos;s really you.
        </p>
        <div className="sv-acct-actions">
          <Link href={copyHref} className="btn btn-ghost">Request a copy of my data</Link>
          <Link href={deleteHref} className="btn btn-ghost sv-danger">Request account deletion</Link>
        </div>
      </section>

      <section className="card sv-acct-card" aria-labelledby="p-dev">
        <h2 id="p-dev" className="sv-acct-h">On this device</h2>
        <p className="sv-acct-note">
          Savoria keeps a few things in this browser: your sign-in session, your theme, your app preferences, which
          support replies you&apos;ve already seen, and short-lived checkout details. Nothing here is shared with other sites.
        </p>
        <div className="sv-acct-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
            Clear preferences & history on this device
          </button>
        </div>
      </section>

      {confirmClear && (
        <ConfirmDialog
          title="Clear data on this device?"
          message="This resets your app preferences and marks support replies as unread again. You'll stay signed in, and nothing on your account changes."
          confirmLabel="Clear"
          onClose={() => setConfirmClear(false)}
          onConfirm={() => {
            clearDeviceData();
            setConfirmClear(false);
            push('Cleared data stored on this device');
          }}
        />
      )}
    </SettingsShell>
  );
}
