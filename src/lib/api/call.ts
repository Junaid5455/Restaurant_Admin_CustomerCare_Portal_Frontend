import { unwrap } from '../http';
import { parseError } from '../errors';

/** Runs a request, unwraps the { success, data } envelope when present, and normalises failures to ApiError. */
export async function call<T>(fn: () => Promise<{ data: unknown }>): Promise<T> {
  try {
    const res = await fn();
    return unwrap<T>(res.data);
  } catch (e) {
    throw parseError(e);
  }
}
