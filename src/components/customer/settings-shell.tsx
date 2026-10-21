'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { SETTINGS_SECTIONS, type SettingsSection } from '@/lib/settings-sections';

/** Shared frame for every Settings page: a row of section links, then the page heading and content. */
export function SettingsShell({ active, children }: { active: SettingsSection; children: ReactNode }) {
  const current = SETTINGS_SECTIONS.find((s) => s.id === active) ?? SETTINGS_SECTIONS[0];
  return (
    <>
      <nav className="sv-acct-tabs sv-set-tabs" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/customer/settings/${s.id}`}
            className={`sv-acct-tab ${s.id === active ? 'active' : ''}`}
            aria-current={s.id === active ? 'page' : undefined}
          >
            <span aria-hidden="true">{s.icon}</span>
            {s.text}
          </Link>
        ))}
      </nav>

      <div className="sv-page-head sv-acct-pagehead">
        <div>
          <h1>{current.title}</h1>
          <p>{current.description}</p>
        </div>
      </div>

      <div className="sv-set-stack">{children}</div>
    </>
  );
}
