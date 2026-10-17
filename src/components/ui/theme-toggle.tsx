'use client';

import { useTheme } from '@/context/theme-context';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, mounted, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className={`icon-btn ${className ?? ''}`} onClick={toggle} aria-label={`Switch to ${next} theme`} title="Toggle theme">
      <span aria-hidden="true">{mounted ? (theme === 'dark' ? '☀️' : '🌙') : '☀️'}</span>
    </button>
  );
}
