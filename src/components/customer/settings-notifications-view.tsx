'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsShell } from './settings-shell';
import { Alert } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth-context';
import { DEFAULT_PREFS, preferencesApi, type NotificationPrefs, type PrefKey, type PrefsRecord } from '@/lib/api/preferences';
import { parseError } from '@/lib/errors';

export const PREFS_KEY = ['notification-prefs'] as const;

/** `record` is null when the customer has no preferences row yet; the first change creates it. */
export interface PrefsData {
  record: PrefsRecord | null;
}

export function usePrefsQuery() {
  return useQuery<PrefsData>({
    queryKey: PREFS_KEY,
    queryFn: async () => ({ record: await preferencesApi.get() }),
    staleTime: 60_000,
    retry: false,
  });
}

export function SettingsNotificationsView() {
  const { user } = useAuth();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const prefsQuery = usePrefsQuery();

  // Values shown while a save is in flight, so a switch flips instantly and rolls back if the save fails.
  const [overlay, setOverlay] = useState<Partial<NotificationPrefs>>({});
  const [saving, setSaving] = useState<Partial<Record<PrefKey, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  // Saves run one after another, so two quick taps can never both try to create the preferences row.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const record = prefsQuery.data?.record ?? null;
  const shown: NotificationPrefs = { ...DEFAULT_PREFS, ...(record ?? {}), ...overlay };

  const change = useCallback(
    (key: PrefKey, value: boolean) => {
      setError(null);
      setOverlay((o) => ({ ...o, [key]: value }));
      setSaving((s) => ({ ...s, [key]: true }));
      queue.current = queue.current.then(async () => {
        try {
          const current = queryClient.getQueryData<PrefsData>(PREFS_KEY)?.record ?? null;
          const saved = await preferencesApi.save(current, { [key]: value });
          queryClient.setQueryData<PrefsData>(PREFS_KEY, { record: saved });
          setAnnounce(`Saved. ${LABELS[key]} is ${value ? 'on' : 'off'}.`);
        } catch (e) {
          const msg = parseError(e).display;
          setError(`We couldn't save that change. ${msg}`);
          push("Couldn't save your notification settings", 'error');
        } finally {
          setOverlay((o) => {
            const { [key]: _drop, ...rest } = o;
            void _drop;
            return rest;
          });
          setSaving((s) => ({ ...s, [key]: false }));
        }
      });
    },
    [push, queryClient],
  );

  const hasPhone = !!user?.phone;

  return (
    <SettingsShell active="notifications">
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {prefsQuery.isPending && (
        <div aria-busy="true" aria-label="Loading">
          <div className="sv-skel" style={{ height: 150, borderRadius: 16, marginBottom: 14 }} />
          <div className="sv-skel" style={{ height: 260, borderRadius: 16 }} />
        </div>
      )}

      {prefsQuery.isError && (
        <div className="card sv-state" role="alert">
          <div className="sv-state-icon" aria-hidden="true">🔕</div>
          <h2>Couldn&apos;t load your notification settings</h2>
          <p>{parseError(prefsQuery.error).display}</p>
          <Button onClick={() => prefsQuery.refetch()}>Try again</Button>
        </div>
      )}

      {prefsQuery.data && (
        <>
          {error && <Alert>{error}</Alert>}

          <section className="card sv-acct-card" aria-labelledby="n-orders">
            <h2 id="n-orders" className="sv-acct-h">Your orders</h2>
            <Switch
              label="Order updates"
              description="Tell me when an order is confirmed, being prepared, on its way, or ready for pickup."
              checked={shown.order_updates}
              busy={saving.order_updates}
              onChange={(v) => change('order_updates', v)}
              note="Account emails such as password resets and email verification are always sent."
            />
            {!shown.order_updates && (
              <Alert kind="info">
                You won&apos;t be told when your orders change. You can still follow any order live from{' '}
                <Link href="/customer/orders" className="sv-link-btn">My orders</Link>.
              </Alert>
            )}
          </section>

          <section className="card sv-acct-card" aria-labelledby="n-promos">
            <h2 id="n-promos" className="sv-acct-h">Offers & promotions</h2>
            <Switch
              label="Email"
              description="Deals, new restaurants and reward reminders."
              checked={shown.email_promotions}
              busy={saving.email_promotions}
              onChange={(v) => change('email_promotions', v)}
            />
            <Switch
              label="Text messages (SMS)"
              description="Occasional offers by text."
              checked={shown.sms_promotions}
              busy={saving.sms_promotions}
              onChange={(v) => change('sms_promotions', v)}
              note={
                hasPhone ? undefined : (
                  <>
                    No phone number on your account yet, so nothing can be sent.{' '}
                    <Link href="/customer/profile" className="sv-link-btn">Add one in your profile</Link>.
                  </>
                )
              }
            />
            <Switch
              label="Push notifications"
              description="Offers sent to the Savoria mobile app."
              checked={shown.push_promotions}
              busy={saving.push_promotions}
              onChange={(v) => change('push_promotions', v)}
            />
          </section>

          <p className="sv-acct-note">Changes are saved as soon as you make them.</p>
        </>
      )}
    </SettingsShell>
  );
}

const LABELS: Record<PrefKey, string> = {
  order_updates: 'Order updates',
  email_promotions: 'Email offers',
  sms_promotions: 'Text message offers',
  push_promotions: 'Push notifications',
};
