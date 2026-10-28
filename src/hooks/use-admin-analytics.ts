import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAnalyticsApi } from '@/lib/api/admin-analytics';

const base = { retry: false, refetchOnWindowFocus: true } as const;

export const useOverview = () => useQuery({ queryKey: ['an-overview'], queryFn: adminAnalyticsApi.overview, staleTime: 60_000, ...base });
export const useSales = () => useQuery({ queryKey: ['an-sales'], queryFn: adminAnalyticsApi.sales, staleTime: 60_000, ...base });
export const usePopular = () => useQuery({ queryKey: ['an-popular'], queryFn: adminAnalyticsApi.popularItems, staleTime: 120_000, ...base });
export const useTopCustomers = () => useQuery({ queryKey: ['an-customers'], queryFn: adminAnalyticsApi.customers, staleTime: 120_000, ...base });
export const usePeakHours = () => useQuery({ queryKey: ['an-peak'], queryFn: adminAnalyticsApi.peakHours, staleTime: 120_000, ...base });
export const useOrderCounts = () => useQuery({ queryKey: ['an-counts'], queryFn: adminAnalyticsApi.counts, staleTime: 60_000, ...base });
/** The latest orders, loaded once and shared by the pages that look inside orders. */
export const useOrderSample = () => useQuery({ queryKey: ['an-sample'], queryFn: () => adminAnalyticsApi.sample(), staleTime: 120_000, ...base });

/** A choice that sticks between visits (and survives a blocked localStorage). */
export function useStoredChoice<T extends string | number>(storageKey: string, initial: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = (typeof initial === 'number' ? Number(raw) : raw) as T;
      if (raw !== null && allowed.includes(parsed)) setValue(parsed);
    } catch {
      /* private mode: the choice just lasts this visit */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(storageKey, String(v));
    } catch {
      /* ignore */
    }
  };
  return [value, set];
}
