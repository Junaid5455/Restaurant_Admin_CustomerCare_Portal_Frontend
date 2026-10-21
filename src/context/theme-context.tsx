'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { THEME_KEY } from '@/lib/constants';

type Theme = 'dark' | 'light';
/** What the person chose. 'system' follows the operating system and is stored as "no saved value". */
export type ThemePreference = 'system' | Theme;

interface ThemeValue {
  /** The theme actually showing right now. */
  theme: Theme;
  preference: ThemePreference;
  mounted: boolean;
  /** Quick flip used by the header button: always becomes an explicit choice. */
  toggle: () => void;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function savedPreference(): ThemePreference {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [preference, setPref] = useState<ThemePreference>('system');
  const [mounted, setMounted] = useState(false);

  // The inline script in <head> has already set data-theme before paint; just sync React state to it.
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
    setPref(savedPreference());
    setMounted(true);
  }, []);

  const apply = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  }, []);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPref(p);
      try {
        if (p === 'system') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, p);
      } catch {
        /* storage unavailable: the choice just won't persist */
      }
      apply(p === 'system' ? systemTheme() : p);
    },
    [apply],
  );

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [setPreference, theme]);

  // While following the system, react when the OS flips between light and dark.
  useEffect(() => {
    if (preference !== 'system') return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-color-scheme: light)');
    } catch {
      return;
    }
    const onChange = () => apply(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference, apply]);

  return (
    <ThemeContext.Provider value={{ theme, preference, mounted, toggle, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Runs before first paint to avoid a dark/light flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
