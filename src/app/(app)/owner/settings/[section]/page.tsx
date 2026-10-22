import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DeliveryZonesView } from '@/components/admin/delivery-zones-view';
import { OperatingHoursView } from '@/components/admin/operating-hours-view';
import { RestaurantDetailsView } from '@/components/admin/restaurant-details-view';
import { TaxFeesView } from '@/components/admin/tax-fees-view';
import { RESTAURANT_SETTINGS_SECTIONS, isRestaurantSettingsSection } from '@/lib/restaurant-settings-sections';

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const s = RESTAURANT_SETTINGS_SECTIONS.find((x) => x.id === section);
  return { title: s ? s.title : 'Settings' };
}

export default async function OwnerSettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isRestaurantSettingsSection(section)) notFound();
  switch (section) {
    case 'details':
      return <RestaurantDetailsView />;
    case 'hours':
      return <OperatingHoursView />;
    case 'delivery':
      return <DeliveryZonesView />;
    case 'fees':
      return <TaxFeesView />;
  }
}
