import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function Brand() {
  return (
    <div className="brand-logo">
      <div className="brand-icon" aria-hidden="true">🍽</div>
      <div>
        <div className="brand-name">Savoria</div>
        <div className="brand-sub">Restaurant Portal</div>
      </div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-hero">
        <Brand />
        <div>
          <h2 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, maxWidth: 380 }}>
            Run your whole restaurant from one place.
          </h2>
          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 360 }}>
            Orders, kitchen, delivery, menu and support, with a view built for every role on your team.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
            <span className="hero-chip">📋 Live orders</span>
            <span className="hero-chip">🍳 Kitchen display</span>
            <span className="hero-chip">🛵 Delivery tracking</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>© {new Date().getFullYear()} Savoria</p>
      </aside>

      <main className="auth-panel">
        <ThemeToggle className="" />
        <style>{`.auth-panel > .icon-btn{position:absolute;top:20px;right:20px}`}</style>
        <div className="card auth-card">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{title}</h1>
          {subtitle && <p style={{ color: 'var(--fg-2)', marginTop: 6, marginBottom: 22 }}>{subtitle}</p>}
          {!subtitle && <div style={{ height: 22 }} />}
          {children}
        </div>
      </main>
    </div>
  );
}
