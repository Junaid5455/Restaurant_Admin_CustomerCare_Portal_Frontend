'use client';

import { useId } from 'react';
import { SettingsShell } from './settings-shell';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useTheme, type ThemePreference } from '@/context/theme-context';
import { useAppPrefs, writeAppPrefs } from '@/lib/app-prefs';
import type { OrderType } from '@/lib/api/cart';

function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; icon: string; text: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="sv-setting sv-setting-stack">
      <div className="sv-setting-text">
        <div className="sv-setting-label" id={`${id}-l`}>{label}</div>
        {hint && <p className="sv-setting-desc">{hint}</p>}
      </div>
      <div className="sv-choice" role="radiogroup" aria-labelledby={`${id}-l`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              // Arrow keys move the selection, like a native radio group.
              const i = options.findIndex((x) => x.value === value);
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = options[(i + step + options.length) % options.length];
              onChange(next.value);
              (e.currentTarget.parentElement?.querySelectorAll('button')[options.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}
            tabIndex={value === o.value ? 0 : -1}
          >
            <span aria-hidden="true">{o.icon}</span>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

const THEMES: { value: ThemePreference; icon: string; text: string }[] = [
  { value: 'system', icon: '💻', text: 'System' },
  { value: 'light', icon: '☀️', text: 'Light' },
  { value: 'dark', icon: '🌙', text: 'Dark' },
];

type OrderChoice = OrderType | 'none';
const ORDER_CHOICES: { value: OrderChoice; icon: string; text: string }[] = [
  { value: 'none', icon: '✨', text: 'No preference' },
  { value: 'DELIVERY', icon: '🛵', text: 'Delivery' },
  { value: 'PICKUP', icon: '🥡', text: 'Pickup' },
  { value: 'DINE_IN', icon: '🍽', text: 'Dine-in' },
];

export function SettingsPreferencesView() {
  const { push } = useToast();
  const { preference, setPreference, mounted } = useTheme();
  const prefs = useAppPrefs();

  function save(patch: Parameters<typeof writeAppPrefs>[0]) {
    if (!writeAppPrefs(patch)) push("This browser won't let us save preferences, so they'll reset when you leave.", 'error');
  }

  return (
    <SettingsShell active="preferences">
      <section className="card sv-acct-card" aria-labelledby="pr-look">
        <h2 id="pr-look" className="sv-acct-h">Appearance</h2>
        <Choice
          label="Theme"
          hint="System follows your device and switches automatically between light and dark."
          value={mounted ? preference : 'system'}
          options={THEMES}
          onChange={setPreference}
        />
        <Switch
          label="Reduce motion"
          description="Turn off animations and transitions. If your device already asks for reduced motion, we follow that either way."
          checked={prefs.reduceMotion}
          onChange={(v) => save({ reduceMotion: v })}
        />
      </section>

      <section className="card sv-acct-card" aria-labelledby="pr-order">
        <h2 id="pr-order" className="sv-acct-h">Ordering</h2>
        <Choice
          label="Preferred order type"
          hint="Pre-selected at checkout when the restaurant offers it. You can still change it for any order."
          value={(prefs.orderType ?? 'none') as OrderChoice}
          options={ORDER_CHOICES}
          onChange={(v) => save({ orderType: v === 'none' ? null : v })}
        />
      </section>

      <p className="sv-acct-note">
        These settings are saved on this device only, so they won&apos;t follow you to another browser.
      </p>
    </SettingsShell>
  );
}
