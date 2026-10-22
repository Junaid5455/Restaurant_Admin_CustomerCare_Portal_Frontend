/** Plain module (no 'use client') so the server page and the client components can both import it. */
export type RestaurantSettingsSection = 'details' | 'hours' | 'delivery' | 'fees';

export const RESTAURANT_SETTINGS_SECTIONS: { id: RestaurantSettingsSection; icon: string; text: string; title: string; description: string }[] = [
  { id: 'details', icon: '🏪', text: 'Restaurant details', title: 'Restaurant details', description: 'The name, contact details, address and photos guests see.' },
  { id: 'hours', icon: '🕒', text: 'Operating hours', title: 'Operating hours', description: 'When you take orders, and the days you are closed.' },
  { id: 'delivery', icon: '🛵', text: 'Delivery & zones', title: 'Delivery & zones', description: 'How guests can order, and where you deliver.' },
  { id: 'fees', icon: '💰', text: 'Tax & fees', title: 'Tax & fees', description: 'Tax, delivery fee and minimum order, with a live example.' },
];

export function isRestaurantSettingsSection(v: string): v is RestaurantSettingsSection {
  return RESTAURANT_SETTINGS_SECTIONS.some((s) => s.id === v);
}
