import { BaseHttpRequest } from './generated/core/BaseHttpRequest';
import type { ApiRequestOptions } from './generated/core/ApiRequestOptions';
import { CancelablePromise } from './generated/core/CancelablePromise';
import type { OpenAPIConfig } from './generated/core/OpenAPI';
import { request as send } from './generated/core/request';

/**
 * How long one API request may take, answer included. On weak campus wifi or with a hung API a request could
 * otherwise wait minutes for the browser to give up, and every button waiting on it ("Mengirim…", "Masuk…") with it.
 */
export const REQUEST_TIMEOUT_MS = 25_000;

/** A request that ran out of time. Not an `ApiError`: screens treat it as a failed connection (Coba lagi). */
export class RequestTimeoutError extends Error {
  constructor(readonly ms: number) {
    super(`The API didn't answer within ${ms} ms`);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * The generated client's request (`generated/core/request.ts`, which regeneration rewrites) with a time limit: past
 * it the fetch is aborted and the request fails with `RequestTimeoutError`. Passed to `ApiClient` as its
 * `HttpRequest`, so the generated files stay as generated.
 */
export function timedHttpRequest(ms: number = REQUEST_TIMEOUT_MS) {
  return class TimedHttpRequest extends BaseHttpRequest {
    constructor(config: OpenAPIConfig) {
      super(config);
    }

    override request<T>(options: ApiRequestOptions): CancelablePromise<T> {
      const inner = send<T>(this.config, options);
      return new CancelablePromise<T>((resolve, reject, onCancel) => {
        const timer = setTimeout(() => {
          reject(new RequestTimeoutError(ms));
          inner.cancel();
        }, ms);
        onCancel(() => {
          clearTimeout(timer);
          inner.cancel();
        });
        inner.then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (error: unknown) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
    }
  };
}
