'use client';

import { useEffect } from 'react';
import { applyAppPrefs, useAppPrefs } from '@/lib/app-prefs';

/** Renders nothing; keeps document-level app preferences (like reduced motion) in sync with storage. */
export function AppPrefsApplier() {
  const prefs = useAppPrefs();
  useEffect(() => {
    applyAppPrefs(prefs);
  }, [prefs]);
  return null;
}
