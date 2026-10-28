'use client';

import './staff.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PERMISSIONS, displayName, roleLabel } from '@/lib/staff';
import type { StaffMember, StaffPermissions } from '@/lib/api/admin-staff';
import { initials } from '@/lib/format';

type Active = 'team' | 'permissions' | 'activity';

/** Heading plus the Team / Permissions / Activity tabs. */
export function StaffFrame({ active, title, description, actions, children }: { active: Active; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  const tabs: { id: Active; href: string; icon: string; text: string }[] = [
    { id: 'team', href: '/owner/staff', icon: '👥', text: 'Team' },
    { id: 'permissions', href: '/owner/staff/permissions', icon: '🔐', text: 'Permissions' },
    { id: 'activity', href: '/owner/staff/activity', icon: '🕘', text: 'Activity' },
  ];
  return (
    <>
      <nav className="ad-tabs" aria-label="Staff sections">
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

export function StaffAvatar({ member, size = 44 }: { member: Pick<StaffMember, 'user_email' | 'user_name'>; size?: number }) {
  return (
    <span className="st-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {initials(displayName(member)) || '?'}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return <span className={`badge st-role st-role-${role.toLowerCase()}`}>{roleLabel(role)}</span>;
}

/** The permissions a person has, as small chips. */
export function PermissionChips({ perms }: { perms: StaffPermissions }) {
  const on = PERMISSIONS.filter((p) => perms[p.key]);
  if (on.length === 0) return <span className="ad-muted">No extra permissions</span>;
  return (
    <ul className="st-chips" aria-label="Permissions">
      {on.map((p) => (
        <li key={p.key}>{p.label}</li>
      ))}
    </ul>
  );
}
