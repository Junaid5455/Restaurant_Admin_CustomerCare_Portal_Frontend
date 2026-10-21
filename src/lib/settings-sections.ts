/** Plain module (no 'use client') so both server pages and client components can import it. */
export type SettingsSection = 'notifications' | 'account' | 'privacy' | 'preferences';

export const SETTINGS_SECTIONS: { id: SettingsSection; icon: string; text: string; title: string; description: string }[] = [
  { id: 'notifications', icon: '🔔', text: 'Notifications', title: 'Notifications', description: 'Choose what we tell you about, and where.' },
  { id: 'account', icon: '🔐', text: 'Account', title: 'Account settings', description: 'Your sign-in details and security.' },
  { id: 'privacy', icon: '🛡️', text: 'Privacy', title: 'Privacy & data', description: 'See what we keep, and ask for a copy or for deletion.' },
  { id: 'preferences', icon: '🎛️', text: 'App preferences', title: 'App preferences', description: 'How Savoria looks and behaves on this device.' },
];

export function isSettingsSection(v: string): v is SettingsSection {
  return SETTINGS_SECTIONS.some((s) => s.id === v);
}
