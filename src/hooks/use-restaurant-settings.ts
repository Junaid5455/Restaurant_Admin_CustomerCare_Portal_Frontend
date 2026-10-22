import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { restaurantSettingsApi, type RestaurantSettings, type SettingsPatch } from '@/lib/api/restaurant-settings';

export const SETTINGS_KEY = ['restaurant-settings'] as const;

export function useRestaurantSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: restaurantSettingsApi.get, staleTime: 60_000, retry: false });
}

/** Saves a partial update and puts the server's answer straight into the cache. */
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => restaurantSettingsApi.patch(patch),
    onSuccess: (saved: RestaurantSettings) => qc.setQueryData(SETTINGS_KEY, saved),
  });
}

/** Asks the browser to confirm before the tab is closed or reloaded with unsaved edits. */
export function useUnsavedWarning(dirty: boolean) {
  const handler = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  }, []);
  useEffect(() => {
    if (!dirty) return;
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, handler]);
}
