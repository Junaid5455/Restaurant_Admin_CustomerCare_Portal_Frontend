'use client';

import './deliveries.css';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/submit-button';
import { useToast } from '@/components/ui/toast';
import { deliveryError, useAdvance, useAssignDriver, useStepBlocked } from '@/hooks/use-admin-delivery';
import { useStaff } from '@/hooks/use-admin-staff';
import type { AdminDelivery, DeliveryStatus } from '@/lib/api/admin-delivery';
import { DELIVERY_BADGE, DELIVERY_LABEL, STEP_LABEL, activeDrivers, etaText, isFinished, nextStep } from '@/lib/delivery';
import { displayName, roleLabel } from '@/lib/staff';
import { parseError } from '@/lib/errors';

type Active = 'list' | 'map';

export function DeliveryFrame({ active, title, description, actions, children }: { active: Active | null; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const tabs: { id: Active; href: string; icon: string; text: string }[] = [
    { id: 'list', href: '/owner/deliveries', icon: '📦', text: 'Deliveries' },
    { id: 'map', href: '/owner/deliveries/map', icon: '🗺', text: 'Live map' },
  ];
  return (
    <>
      <nav className="ad-tabs" aria-label="Delivery sections">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} className={`ad-tab ${t.id === active ? 'active' : ''}`} aria-current={t.id === active ? 'page' : undefined}>
            <span aria-hidden="true">{t.icon}</span>
            {t.text}
          </Link>
        ))}
      </nav>
      <div className="ad-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="ad-head-actions">{actions}</div>}
      </div>
      <div className="ad-stack">{children}</div>
    </>
  );
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return <span className={`badge ${DELIVERY_BADGE[status]}`}>{DELIVERY_LABEL[status]}</span>;
}

export function EtaTag({ d, now }: { d: AdminDelivery; now: number }) {
  const eta = etaText(d, now);
  if (!eta) return null;
  return <span className={`dl-eta ${eta.late ? 'is-late' : ''}`}>{eta.late ? '⚠ ' : '⏱ '}{eta.text}</span>;
}

/** Pick one of the active drivers. Re-assigning a delivery that is already with a driver is allowed until pickup. */
export function AssignModal({ delivery, activeCounts, onClose }: { delivery: AdminDelivery; activeCounts: Record<string, number>; onClose: () => void }) {
  const { push } = useToast();
  const staff = useStaff();
  const assign = useAssignDriver();
  const [pick, setPick] = useState<string | null>(delivery.driver);
  const drivers = staff.data ? activeDrivers(staff.data) : [];
  const inactive = staff.data ? staff.data.filter((m) => m.role === 'DELIVERY_STAFF' && !m.is_active).length : 0;
  const changed = !!pick && pick !== delivery.driver;
  const who = drivers.find((m) => m.id === pick);

  function save() {
    if (!pick) return;
    assign.mutate(
      { id: delivery.id, driverId: pick },
      {
        onSuccess: () => {
          push(`Order #${delivery.order_number} assigned to ${who ? displayName(who) : 'the driver'}`);
          onClose();
        },
        onError: (e) => push(deliveryError(e), 'error'),
      },
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="dl-assign-title">
      <div className="dl-modal">
        <h2 id="dl-assign-title" className="ad-card-title">{delivery.driver ? 'Change driver' : 'Assign a driver'}</h2>
        <p className="an-sub">Order #{delivery.order_number}{delivery.delivery_address ? ` · ${delivery.delivery_address}` : ''}</p>

        {staff.isPending ? (
          <div className="ad-skel" style={{ height: 120, borderRadius: 12 }} aria-busy="true" aria-label="Loading drivers" />
        ) : staff.isError ? (
          <div className="ad-empty" role="alert">
            <strong>We couldn&apos;t load your drivers</strong>
            <span>{parseError(staff.error).display}</span>
            <Button onClick={() => void staff.refetch()}>Try again</Button>
          </div>
        ) : drivers.length === 0 ? (
          <div className="ad-empty">
            <strong>No active drivers yet</strong>
            <span>Add someone with the “{roleLabel('DELIVERY_STAFF')}” role to send deliveries out.{inactive > 0 ? ` (${inactive} inactive ${inactive === 1 ? 'driver is' : 'drivers are'} hidden.)` : ''}</span>
            <Link className="btn btn-primary" href="/owner/staff/new">Add a driver</Link>
          </div>
        ) : (
          <fieldset className="dl-drivers">
            <legend className="sr-only">Drivers</legend>
            {drivers.map((m) => {
              const n = activeCounts[m.id] ?? 0;
              return (
                <label key={m.id} className={`dl-driver ${pick === m.id ? 'on' : ''}`}>
                  <input type="radio" name="driver" value={m.id} checked={pick === m.id} onChange={() => setPick(m.id)} />
                  <span className="dl-driver-av" aria-hidden="true">{displayName(m).slice(0, 1).toUpperCase()}</span>
                  <span className="dl-driver-main">
                    <strong>{displayName(m)}</strong>
                    <small>{m.user_email}</small>
                  </span>
                  <span className={`dl-load ${n === 0 ? 'free' : ''}`}>{m.id === delivery.driver ? 'Current driver' : n === 0 ? 'Free now' : `${n} on the road`}</span>
                </label>
              );
            })}
            {inactive > 0 && <p className="an-note">{inactive} inactive {inactive === 1 ? 'driver isn’t' : 'drivers aren’t'} shown.</p>}
          </fieldset>
        )}

        <div className="dl-modal-actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={assign.isPending} loadingText="Assigning…" disabled={!changed || drivers.length === 0} onClick={save}>
            {delivery.driver ? 'Change driver' : 'Assign driver'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Pick-up / deliver. Turns into a hint once the server has told us this account can't do it. */
export function StepButton({ delivery, small }: { delivery: AdminDelivery; small?: boolean }) {
  const { push } = useToast();
  const advance = useAdvance();
  const { blocked } = useStepBlocked();
  const step = nextStep(delivery);
  if (!step || isFinished(delivery.status)) return null;
  if (blocked) return <span className="dl-hint" title="Your account can’t change delivery status. The assigned driver does it from the driver page.">Driver updates this</span>;
  if (step === 'pickup' && !delivery.driver) return null;
  return (
    <Button
      className={small ? 'ad-btn-sm' : undefined}
      variant="ghost"
      loading={advance.isPending}
      loadingText="Updating…"
      aria-label={`${STEP_LABEL[step]} for order ${delivery.order_number}`}
      onClick={() =>
        advance.mutate(
          { id: delivery.id, step },
          {
            onSuccess: () => push(step === 'pickup' ? `Order #${delivery.order_number} is on the way` : `Order #${delivery.order_number} delivered`),
            onError: (e) => push(deliveryError(e), 'error'),
          },
        )
      }
    >
      {STEP_LABEL[step]}
    </Button>
  );
}
