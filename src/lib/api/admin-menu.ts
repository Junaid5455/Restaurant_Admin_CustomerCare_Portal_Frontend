import { api } from '../http';
import { parseError } from '../errors';
import { call } from './call';

export type CustomizationType = 'SINGLE_SELECT' | 'MULTIPLE_SELECT' | 'TEXT_INPUT';

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  order: number;
  is_active: boolean;
  item_count: number;
}

/** MenuItemSerializer: what the list and every write returns. It has no category and no dietary flags. */
export interface MenuItemRow {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string | null;
  prep_time: number;
  is_available: boolean;
  is_featured: boolean;
  is_new: boolean;
  rating: string;
  review_count: number;
}

/** A row plus the category we worked out for it (the list endpoint can only filter by category, not return it). */
export interface MenuItem extends MenuItemRow {
  category_id: string | null;
}

export interface CustomizationOption {
  id: string;
  name: string;
  price_modifier: string;
  order: number;
}

export interface Customization {
  id: string;
  name: string;
  type: CustomizationType;
  is_required: boolean;
  options: CustomizationOption[];
}

export interface AddOn {
  id: string;
  name: string;
  price: string;
  is_available: boolean;
}

/** MenuItemDetailSerializer */
export interface MenuItemDetail extends MenuItemRow {
  is_spicy: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  calories: number | null;
  customizations: Customization[];
  add_ons: AddOn[];
  category: MenuCategory | null;
}

export interface MenuSnapshot {
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface CategoryInput {
  name: string;
  description: string;
  is_active: boolean;
  order?: number;
}

export interface ItemInput {
  name: string;
  description: string;
  /** Two-decimal string, e.g. "450.00". */
  price: string;
  category_id: string;
  is_available: boolean;
  is_featured: boolean;
  is_new: boolean;
  /** Not accepted by the stock MenuItemSerializer; see the backend notes. */
  prep_time?: number;
  calories?: number | null;
  is_spicy?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
}

interface Envelope<T> {
  data: T[];
  meta?: { total_pages?: number; has_next?: boolean };
}
interface Plain<T> {
  count: number;
  results: T[];
  next: string | null;
}

/** Reads every page of a list endpoint (the API caps a page at 100). */
async function listAll<T>(path: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const out: T[] = [];
  try {
    for (let page = 1; page <= 30; page++) {
      const res = await api.get(path, { params: { ...params, page, page_size: 100 } });
      const body = res.data as Envelope<T> | Plain<T> | T[];
      if (Array.isArray(body)) return body;
      if ('results' in body) {
        out.push(...body.results);
        if (!body.next) break;
      } else {
        out.push(...(body.data ?? []));
        if (!body.meta?.has_next && (body.meta?.total_pages ?? 1) <= page) break;
        if (body.meta?.has_next === false) break;
      }
    }
    return out;
  } catch (e) {
    throw parseError(e);
  }
}

function form(values: Record<string, string | number | boolean | null | undefined>, image?: File | null): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) if (v !== undefined && v !== null) f.append(k, String(v));
  if (image) f.append('image', image);
  return f;
}

export const adminMenuApi = {
  categories: () => listAll<MenuCategory>('/menu/categories/'),

  /**
   * Everything the menu pages need in one go. The item list can't say which category an item is in, so each
   * category's items are fetched with `?category=` and the rest are uncategorised.
   */
  async snapshot(): Promise<MenuSnapshot> {
    const [categories, items] = await Promise.all([listAll<MenuCategory>('/menu/categories/'), listAll<MenuItemRow>('/menu/items/')]);
    const sorted = [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const perCategory = await Promise.all(sorted.map((c) => listAll<MenuItemRow>('/menu/items/', { category: c.id })));
    const categoryOf = new Map<string, string>();
    perCategory.forEach((rows, i) => rows.forEach((r) => categoryOf.set(r.id, sorted[i].id)));
    return { categories: sorted, items: items.map((i) => ({ ...i, category_id: categoryOf.get(i.id) ?? null })) };
  },

  createCategory(restaurantId: string, input: CategoryInput, image?: File | null) {
    const values = { restaurant_id: restaurantId, name: input.name, description: input.description, is_active: input.is_active, order: input.order };
    return call<MenuCategory>(() => (image ? api.post('/menu/categories/', form(values, image)) : api.post('/menu/categories/', values)));
  },
  updateCategory: (id: string, patch: Partial<CategoryInput>) => call<MenuCategory>(() => api.patch(`/menu/categories/${id}/`, patch)),
  uploadCategoryImage: (id: string, file: File) => call<MenuCategory>(() => api.patch(`/menu/categories/${id}/`, form({}, file))),
  removeCategoryImage: (id: string) => call<MenuCategory>(() => api.patch(`/menu/categories/${id}/`, { image: null })),
  async deleteCategory(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/menu/categories/${id}/`));
  },

  getItem: (id: string) => call<MenuItemDetail>(() => api.get(`/menu/items/${id}/`)),
  createItem(input: ItemInput, image?: File | null) {
    return call<MenuItemRow>(() => (image ? api.post('/menu/items/', form({ ...input }, image)) : api.post('/menu/items/', input)));
  },
  updateItem: (id: string, patch: Partial<ItemInput>) => call<MenuItemRow>(() => api.patch(`/menu/items/${id}/`, patch)),
  uploadItemImage: (id: string, file: File) => call<MenuItemRow>(() => api.patch(`/menu/items/${id}/`, form({}, file))),
  removeItemImage: (id: string) => call<MenuItemRow>(() => api.patch(`/menu/items/${id}/`, { image: null })),
  async deleteItem(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/menu/items/${id}/`));
  },

  createCustomization: (itemId: string, v: { name: string; type: CustomizationType; is_required: boolean }) =>
    call<Customization>(() => api.post('/menu/customizations/', { menu_item_id: itemId, ...v })),
  updateCustomization: (id: string, v: Partial<{ name: string; type: CustomizationType; is_required: boolean }>) =>
    call<Customization>(() => api.patch(`/menu/customizations/${id}/`, v)),
  async deleteCustomization(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/menu/customizations/${id}/`));
  },

  /** The stock backend has no endpoint for options; this is the one the backend notes ask for. */
  createOption: (customizationId: string, v: { name: string; price_modifier: string; order: number }) =>
    call<CustomizationOption>(() => api.post('/menu/customization-options/', { customization_id: customizationId, ...v })),
  updateOption: (id: string, v: Partial<{ name: string; price_modifier: string; order: number }>) =>
    call<CustomizationOption>(() => api.patch(`/menu/customization-options/${id}/`, v)),
  async deleteOption(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/menu/customization-options/${id}/`));
  },

  createAddOn: (itemId: string, v: { name: string; price: string; is_available: boolean }) =>
    call<AddOn>(() => api.post('/menu/addons/', { menu_item_id: itemId, ...v })),
  updateAddOn: (id: string, v: Partial<{ name: string; price: string; is_available: boolean }>) => call<AddOn>(() => api.patch(`/menu/addons/${id}/`, v)),
  async deleteAddOn(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/menu/addons/${id}/`));
  },
};
