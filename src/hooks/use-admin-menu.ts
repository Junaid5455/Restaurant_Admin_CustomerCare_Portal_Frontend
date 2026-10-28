import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { adminMenuApi, type MenuCategory, type MenuItem, type MenuItemDetail, type MenuSnapshot } from '@/lib/api/admin-menu';
import { ApiError, parseError } from '@/lib/errors';

export const MENU_KEY = ['admin-menu'] as const;
export const ITEM_KEY = (id: string) => ['admin-menu-item', id] as const;

/** Categories plus every item (with its category), shared by all the menu pages. */
export function useMenu() {
  return useQuery({ queryKey: MENU_KEY, queryFn: adminMenuApi.snapshot, staleTime: 30_000, retry: false, refetchOnWindowFocus: true });
}

export function useMenuItem(id: string | null) {
  return useQuery({ queryKey: ITEM_KEY(id ?? 'none'), queryFn: () => adminMenuApi.getItem(id as string), enabled: !!id, retry: false, staleTime: 0 });
}

export function useMenuCache() {
  const qc = useQueryClient();
  return {
    refresh: (itemId?: string) =>
      Promise.all([qc.invalidateQueries({ queryKey: MENU_KEY }), itemId ? qc.invalidateQueries({ queryKey: ITEM_KEY(itemId) }) : Promise.resolve()]),
    /** Updates one item in place so a toggle feels instant; returns an undo for when the request fails. */
    patchItem: (id: string, patch: Partial<MenuItem>) => patchSnapshotItem(qc, id, patch),
    patchCategory: (id: string, patch: Partial<MenuCategory>) => patchSnapshotCategory(qc, id, patch),
    patchDetail: (id: string, fn: (d: MenuItemDetail) => MenuItemDetail) => qc.setQueryData<MenuItemDetail>(ITEM_KEY(id), (d) => (d ? fn(d) : d)),
  };
}

function patchSnapshotItem(qc: QueryClient, id: string, patch: Partial<MenuItem>): () => void {
  const before = qc.getQueryData<MenuSnapshot>(MENU_KEY);
  const prev = before?.items.find((i) => i.id === id);
  qc.setQueryData<MenuSnapshot>(MENU_KEY, (s) => (s ? { ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : s));
  return () => {
    if (!prev) return;
    const restore = Object.fromEntries(Object.keys(patch).map((k) => [k, prev[k as keyof MenuItem]]));
    qc.setQueryData<MenuSnapshot>(MENU_KEY, (s) => (s ? { ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...restore } : i)) } : s));
  };
}

function patchSnapshotCategory(qc: QueryClient, id: string, patch: Partial<MenuCategory>): () => void {
  const prev = qc.getQueryData<MenuSnapshot>(MENU_KEY)?.categories.find((c) => c.id === id);
  qc.setQueryData<MenuSnapshot>(MENU_KEY, (s) => (s ? { ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : s));
  return () => {
    if (!prev) return;
    const restore = Object.fromEntries(Object.keys(patch).map((k) => [k, prev[k as keyof MenuCategory]]));
    qc.setQueryData<MenuSnapshot>(MENU_KEY, (s) => (s ? { ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...restore } : c)) } : s));
  };
}

/** One sentence for a failed menu request. A 403 gets a clearer explanation than the API's generic text. */
export function menuError(e: unknown): string {
  const err = parseError(e);
  if (err instanceof ApiError && err.status === 403) return "The server didn't allow that change for your account.";
  return err.display;
}
