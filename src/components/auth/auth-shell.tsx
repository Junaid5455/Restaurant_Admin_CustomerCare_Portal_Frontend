import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export interface AuthHero {
  /** Small label under the brand name. */
  brandSub: string;
  heading: string;
  blurb: string;
  chips: string[];
}

const CUSTOMER_HERO: AuthHero = {
  brandSub: 'Restaurant Portal',
  heading: 'Run your whole restaurant from one place.',
  blurb: 'Orders, kitchen, delivery, menu and support, with a view built for every role on your team.',
  chips: ['📋 Live orders', '🍳 Kitchen display', '🛵 Delivery tracking'],
};

function Brand({ sub }: { sub: string }) {
  return (
    <div className="brand-logo">
      <div className="brand-icon" aria-hidden="true">🍽</div>
      <div>
        <div className="brand-name">Savoria</div>
        <div className="brand-sub">{sub}</div>
      </div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children, hero = CUSTOMER_HERO }: { title: string; subtitle?: ReactNode; children: ReactNode; hero?: AuthHero }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-hero">
        <Brand sub={hero.brandSub} />
        <div>
          <h2 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, maxWidth: 380 }}>
            {hero.heading}
          </h2>
          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 360 }}>
            {hero.blurb}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
            {hero.chips.map((c) => (
              <span key={c} className="hero-chip">{c}</span>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>© {new Date().getFullYear()} Savoria</p>
      </aside>

      <main className="auth-panel">
        <ThemeToggle className="" />
        <style>{`.auth-panel > .icon-btn{position:absolute;top:20px;right:20px}`}</style>
        <div className="card auth-card">
          <div className="auth-mobile-brand">
            <Brand sub={hero.brandSub} />
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
