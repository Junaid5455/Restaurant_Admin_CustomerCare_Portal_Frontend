import { api } from '../http';
import { call } from './call';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  latitude: string | null;
  longitude: string | null;
  is_default: boolean;
}

export type AddressInput = Pick<SavedAddress, 'label' | 'address' | 'city' | 'state' | 'country' | 'postal_code'> & {
  is_default: boolean;
};

type Maybe<T> = T[] | { results: T[] };

async function list(): Promise<SavedAddress[]> {
  /** Paginated with the {success,data,meta} envelope, which `call` unwraps to a plain array. */
  const res = await call<Maybe<SavedAddress>>(() => api.get('/users/addresses/', { params: { page_size: 100 } }));
  return Array.isArray(res) ? res : res.results;
}

/**
 * SavedAddressSerializer only clears the old default when an address is CREATED. When an existing address is
 * switched to default, the previous default would stay default too, so clear it here first.
 */
async function clearOtherDefaults(keepId: string) {
  const all = await list();
  await Promise.all(
    all
      .filter((a) => a.id !== keepId && a.is_default)
      .map((a) => call<SavedAddress>(() => api.patch(`/users/addresses/${a.id}/`, { is_default: false }))),
  );
}

export const addressesApi = {
  list,

  create: (input: AddressInput) => call<SavedAddress>(() => api.post('/users/addresses/', input)),

  async update(id: string, input: Partial<AddressInput>): Promise<SavedAddress> {
    if (input.is_default) await clearOtherDefaults(id);
    return call<SavedAddress>(() => api.patch(`/users/addresses/${id}/`, input));
  },

  setDefault: (id: string) => addressesApi.update(id, { is_default: true }),

  async remove(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/users/addresses/${id}/`));
  },
};
