import { OpenAPI } from './generated/core/OpenAPI';
import { timedHttpRequest } from './timed-request';

/**
 * How every generated operation (`./generated/operations`) sends its request. Small on purpose: every page loads
 * it, and each page loads only the operations its own code calls.
 */
export const http = new (timedHttpRequest())({
  ...OpenAPI,
  BASE: import.meta.env?.VITE_API_URL ?? '',
  WITH_CREDENTIALS: true,
  CREDENTIALS: 'include',
  // An id is one path part: the generated default (`encodeURI`) leaves `/` and `?` in it.
  ENCODE_PATH: encodeURIComponent,
});
