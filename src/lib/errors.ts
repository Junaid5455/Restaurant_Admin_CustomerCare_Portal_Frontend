import axios from 'axios';

/**
 * Normalised API error. The backend produces several shapes:
 *   { success:false, message, errors:{ field:[...] } }   (ErrorResponse / custom handler)
 *   { errors:{ detail:"['text']" } }                      (plain-string ValidationError, stringified list)
 *   { error:"text" }                                      (views returning Response({"error": ...}))
 *   { field:[...] }                                       (views returning serializer.errors directly)
 */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  formErrors: string[];

  constructor(message: string, status = 0, fieldErrors: Record<string, string> = {}, formErrors: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.formErrors = formErrors;
  }

  /** Best single sentence to show in a form-level alert. */
  get display(): string {
    return this.formErrors[0] ?? Object.values(this.fieldErrors)[0] ?? this.message;
  }
}

const FORM_KEYS = new Set(['detail', 'non_field_errors', 'error']);

/** "['Cannot checkout']" -> "Cannot checkout" (DRF stringifies plain ValidationError lists). */
function clean(text: string): string {
  const t = text.trim();
  const m = t.match(/^\[\s*(['"])(.*)\1\s*\]$/s);
  return (m ? m[2] : t).replace(/\\'/g, "'");
}

function toStrings(value: unknown): string[] {
  if (typeof value === 'string') return [clean(value)];
  if (Array.isArray(value)) return value.flatMap(toStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(toStrings);
  return [];
}

export function parseError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (!axios.isAxiosError(err)) {
    return new ApiError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
  }

  const status = err.response?.status ?? 0;
  if (!err.response) {
    return new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (status === 429) {
    return new ApiError('Too many requests. Please wait a moment and try again.', 429);
  }
  if (status >= 500) {
    return new ApiError('The server hit a problem. Please try again in a moment.', status);
  }

  const data = err.response.data as Record<string, unknown> | string | undefined;
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];

  if (data && typeof data === 'object') {
    const bag =
      data.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)
        ? (data.errors as Record<string, unknown>)
        : data.success === undefined && !('message' in data)
          ? data
          : {};

    for (const [key, value] of Object.entries(bag)) {
      const messages = toStrings(value);
      if (!messages.length) continue;
      if (FORM_KEYS.has(key)) formErrors.push(...messages);
      else fieldErrors[key] = messages[0];
    }
    if (typeof data.error === 'string') formErrors.push(clean(data.error));
    if (typeof data.detail === 'string') formErrors.push(clean(data.detail));
  }

  const message =
    (data && typeof data === 'object' && typeof data.message === 'string' && data.message) ||
    formErrors[0] ||
    'Request failed. Please check your details and try again.';

  return new ApiError(message, status, fieldErrors, formErrors);
}
