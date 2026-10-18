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

export const addressesApi = {
  /** Paginated with the {success,data,meta} envelope, which `call` unwraps to a plain array. */
  async list(): Promise<SavedAddress[]> {
    const res = await call<Maybe<SavedAddress>>(() => api.get('/users/addresses/', { params: { page_size: 100 } }));
    return Array.isArray(res) ? res : res.results;
  },

  create: (input: AddressInput) => call<SavedAddress>(() => api.post('/users/addresses/', input)),

  update: (id: string, input: Partial<AddressInput>) =>
    call<SavedAddress>(() => api.patch(`/users/addresses/${id}/`, input)),

  async remove(id: string): Promise<void> {
    await call<unknown>(() => api.delete(`/users/addresses/${id}/`));
  },
};
