/**
 * How a review flow runs (F1 brief, step 4). Each flow is a Playwright test that is also the recording:
 *
 * - `flow(id, variant, use, body)` declares one recording of a catalogue flow (flows.ts) for one variant (person),
 *   with that variant's options (`persona`, `roles`, `push`, `installed`, `userAgent`, …). It runs only at the
 *   layouts and themes the catalogue lists; elsewhere it is skipped.
 * - `f.step(title, fn)`: one thing done and its visible outcome asserted, then a pause so the owner can follow. The
 *   time each step starts (seconds from the start of the video) goes into the flow's record for the index.
 * - `f.open(path)`: the first page, then the flow's title as a short chapter over the video.
 * - `f.gate(name)`: the strict audit (axe, overflow, text size, `lang`, 16 px inputs on touch) on a screen. Never
 *   `strictGates`: it resizes the window and Tabs through the page, which would show in the video.
 * - `f.type(locator, text)`: typing at about 40 ms a key; `f.hold()`: at least 1.5 s on a toast or a result.
 * - A known app bug: `{ fails: 'F1-<n>: …' }` marks the recording `test.fail` and keeps its trace.
 *
 * Every flow writes a record (steps and times, result, the mock guard's counts, gates) to `REVIEW_RUN_DIR`
 * (default `e2e/.review/runs`), which `scripts/review.mjs` turns into `data/flows.json`.
 *
 * Pace: on when recording, off with `REVIEW_VIDEO=off` (part 1's checks), unless `REVIEW_PACE=on|off` says.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { ApiMock } from '../support/mock';
import { strictAudit } from '../support/strict';
import { test as base, expect, type HarnessOptions } from '../support/test';
import {
  flowById,
  variantLayouts,
  type Flow,
  type Layout,
  type Theme,
  type Variant,
} from './flows';

export { expect };

const here = path.dirname(fileURLToPath(import.meta.url));
export const RUN_DIR =
  process.env.REVIEW_RUN_DIR ?? path.resolve(here, '..', '.review', 'runs');

const recording = process.env.REVIEW_VIDEO !== 'off';
const paced =
  process.env.REVIEW_PACE === 'on' ||
  (process.env.REVIEW_PACE !== 'off' && recording);
export const PACE = paced
  ? { step: 700, key: 40, hold: 1500, chapter: 1500 }
  : { step: 0, key: 0, hold: 0, chapter: 0 };

/** A review project's layout and theme: `review-phone-light`, `review-narrow320-light`. */
export function projectLayout(
  projectName: string,
): { layout: Layout; theme: Theme } | null {
  const m = /^review-(phone|tablet|desktop|narrow320)-(light|dark)$/.exec(
    projectName,
  );
  return m ? { layout: m[1] as Layout, theme: m[2] as Theme } : null;
}

export interface StepRecord {
  title: string;
  /** Seconds from the start of the video. */
  at: number;
}

export interface FlowRecord {
  flow: string;
  variant: string;
  project: string;
  layout: Layout;
  theme: Theme;
  title: string;
  status: string;
  expectedStatus: string;
  knownFailure: string | null;
  error: string | null;
  durationMs: number;
  steps: StepRecord[];
  gates: string[];
  guard: {
    answered: number;
    blocked: number;
    unhandled: number;
    writes: number;
    problems: string[];
  };
  outputDir: string;
  video: boolean;
}

export class Recorder {
  readonly steps: StepRecord[] = [];
  readonly gates: string[] = [];
  readonly t0 = Date.now();
  private chaptered = false;

  constructor(
    readonly page: Page,
    readonly testInfo: TestInfo,
    readonly entry: Flow,
    readonly variant: Variant,
  ) {}

  private now() {
    return Math.round((Date.now() - this.t0) / 100) / 10;
  }

  /** Go to the flow's first page, then show its title over the video for about 1.5 s. */
  async open(url: string) {
    await this.page.goto(url);
    if (recording && !this.chaptered) {
      this.chaptered = true;
      await this.page.screencast
        .showChapter(this.entry.title, {
          description: this.variant.who,
          duration: PACE.chapter,
        })
        .catch(() => undefined);
      await this.page.waitForTimeout(PACE.chapter);
    }
  }

  /** One step: does one thing and asserts what it shows. */
  async step(title: string, fn: () => Promise<void>) {
    this.steps.push({ title, at: this.now() });
    await base.step(title, fn);
    if (PACE.step) await this.page.waitForTimeout(PACE.step);
  }

  /** The strict audit on the screen as it is (no resize, no Tab). */
  async gate(name: string) {
    this.gates.push(name);
    await strictAudit(this.page, this.testInfo, name);
  }

  /** Type into a field the way a person does (paced) or at once (checks). Clears it first. */
  async type(locator: Locator, text: string) {
    if (PACE.key) {
      await locator.click();
      await locator.clear();
      await locator.pressSequentially(text, { delay: PACE.key });
    } else await locator.fill(text);
  }

  /** Keep a toast or a result on screen long enough to read. */
  async hold(ms = PACE.hold) {
    if (ms) await this.page.waitForTimeout(ms);
  }
}

type Body = (
  args: {
    page: Page;
    f: Recorder;
    api: ApiMock;
    db: import('../fixtures/api').Db;
    layout: Layout;
    theme: Theme;
  },
  testInfo: TestInfo,
) => Promise<void>;

type UseOptions = Parameters<typeof base.use>[0] & Partial<HarnessOptions>;

export const test = base;

/**
 * One recording of a catalogue flow for one variant. `use` sets that variant's options; `fails` marks a known app
 * bug (the flow stays failing and visible, with its trace kept).
 */
export function flow(
  id: string,
  variantKey: string,
  use: UseOptions,
  body: Body,
  opts: { fails?: string } = {},
) {
  const entry = flowById(id);
  const variant = entry.variants.find((v) => v.key === variantKey);
  if (!variant)
    throw new Error(`Flow "${id}" has no variant "${variantKey}" in flows.ts`);
  const layouts = variantLayouts(entry, variant);
  test.describe(`${id} · ${variant.who}`, () => {
    test.use({
      ...(variant.persona !== undefined ? { persona: variant.persona } : {}),
      ...use,
      ...(opts.fails ? { trace: 'on' as const } : {}),
    });
    test(`${entry.title} [${id}:${variantKey}] @flow:${id}`, async (
      { page, api, db },
      testInfo,
    ) => {
      const where = projectLayout(testInfo.project.name);
      test.skip(
        !where ||
          !layouts.includes(where.layout) ||
          !entry.themes.includes(where.theme),
        'not recorded at this layout or theme',
      );
      if (opts.fails) test.fail(true, opts.fails);
      const f = new Recorder(page, testInfo, entry, variant);
      let error: string | null = null;
      try {
        await body(
          { page, f, api, db, layout: where!.layout, theme: where!.theme },
          testInfo,
        );
      } catch (e) {
        error = e instanceof Error ? e.message.split('\n')[0] : String(e);
        throw e;
      } finally {
        writeRecord(f, api, testInfo, where!, error, opts.fails ?? null);
      }
    });
  });
}

function writeRecord(
  f: Recorder,
  api: ApiMock,
  testInfo: TestInfo,
  where: { layout: Layout; theme: Theme },
  error: string | null,
  knownFailure: string | null,
) {
  const by = (o: string) => api.requests.filter((r) => r.outcome === o).length;
  const record: FlowRecord = {
    flow: f.entry.id,
    variant: f.variant.key,
    project: testInfo.project.name,
    layout: where.layout,
    theme: where.theme,
    title: f.entry.title,
    // The body's own result; Playwright's final status (after the guard) is read from its JSON report.
    status: error ? 'failed' : 'passed',
    expectedStatus: knownFailure ? 'failed' : 'passed',
    knownFailure,
    error,
    durationMs: Date.now() - f.t0,
    steps: f.steps,
    gates: f.gates,
    guard: {
      answered:
        by('explicit') + by('default') + by('socket') + by('media') + by('upload'),
      blocked: by('blocked'),
      unhandled: by('unhandled') + by('unmocked-write'),
      writes: api.writes.length,
      problems: [...api.problems],
    },
    outputDir: testInfo.outputDir,
    video: recording,
  };
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(
    path.join(
      RUN_DIR,
      `${f.entry.id}__${f.variant.key}__${testInfo.project.name}.json`,
    ),
    JSON.stringify(record, null, 2),
  );
}
