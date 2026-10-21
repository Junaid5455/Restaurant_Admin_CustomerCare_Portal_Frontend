import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SettingsAccountView } from '@/components/customer/settings-account-view';
import { SettingsNotificationsView } from '@/components/customer/settings-notifications-view';
import { SettingsPreferencesView } from '@/components/customer/settings-preferences-view';
import { SettingsPrivacyView } from '@/components/customer/settings-privacy-view';
import { SETTINGS_SECTIONS, isSettingsSection } from '@/lib/settings-sections';

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const s = SETTINGS_SECTIONS.find((x) => x.id === section);
  return { title: s ? s.title : 'Settings' };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  switch (section) {
    case 'notifications':
      return <SettingsNotificationsView />;
    case 'account':
      return <SettingsAccountView />;
    case 'privacy':
      return <SettingsPrivacyView />;
    case 'preferences':
      return <SettingsPreferencesView />;
  }
}
