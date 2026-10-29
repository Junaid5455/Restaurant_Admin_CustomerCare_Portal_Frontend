'use client';

import './reservations.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Heading plus the "Bookings / Tables" tabs shared by the two Reservations pages. */
export function ReservationsFrame({ active, title, description, actions, children }: { active: 'bookings' | 'tables'; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <nav className="ad-tabs" aria-label="Reservation sections">
        <Link href="/owner/reservations" className={`ad-tab ${active === 'bookings' ? 'active' : ''}`} aria-current={active === 'bookings' ? 'page' : undefined}>
          <span aria-hidden="true">📅</span>Bookings
        </Link>
        <Link href="/owner/reservations/tables" className={`ad-tab ${active === 'tables' ? 'active' : ''}`} aria-current={active === 'tables' ? 'page' : undefined}>
          <span aria-hidden="true">🪑</span>Tables
        </Link>
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
