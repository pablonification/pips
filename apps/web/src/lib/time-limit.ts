/** A promise that never settled within its time limit. */
class TimeLimitError extends Error {
  constructor(readonly ms: number) {
    super(`No answer within ${ms} ms`);
    this.name = 'TimeLimitError';
  }
}

/**
 * `promise`, or a `TimeLimitError` after `ms`. For storage that may never answer: some WebKit versions leave an
 * IndexedDB open pending for good, and whatever waits on it would wait with it.
 */
export function withTimeLimit<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeLimitError(ms)), ms);
    promise.then(
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
