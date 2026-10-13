/** Types for compare.mjs, for the TypeScript tests (tests/capture-states.test.ts). */
export function captureStatus(c: {
  captured: boolean;
  removed?: string;
  sizeDiffers?: boolean;
  ratio?: number;
  threshold: number;
}): 'removed' | 'missing' | 'changed' | 'unchanged';
