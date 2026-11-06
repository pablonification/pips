/**
 * The composer's draft, outside React, so rotating a tablet or resizing across 1024 px (page ↔ dialog) keeps what
 * was typed and the photos uploading. Small on purpose: the composer route's enter and leave hooks import it.
 */
import { useSyncExternalStore } from 'react';
import {
  MAX_INFO_ANNOUNCEMENT_LENGTH as MAX_BODY,
  MAX_INFO_TITLE_LENGTH as MAX_TITLE,
} from '~/lib/constants';
import { getSharedData } from '~/lib/share-db';
import type { UploadProblem } from '~/lib/upload-policy';
import { freshDraft, type Draft } from './draft';
import type { DraftErrors, UploadState } from './rules';

export interface Photo {
  key: string;
  file: File;
  preview: string;
  state: UploadState;
  abort?: AbortController;
}
/** A picked file that can't be uploaded, and why: said under the photos until the next pick. */
export interface RefusedPhoto {
  name: string;
  problem: UploadProblem;
}
export interface ComposeState {
  draft: Omit<Draft, 'mediaUrls'>;
  photos: Photo[];
  errors: DraftErrors;
  refused: RefusedPhoto | null;
}

const blank = (): ComposeState => {
  const { title, body, cats, audType, aud } = freshDraft();
  return {
    draft: { title, body, cats, audType, aud },
    photos: [],
    errors: {},
    refused: null,
  };
};
let state = blank();
const listeners = new Set<() => void>();
export const setCompose = (fn: (s: ComposeState) => ComposeState) => {
  state = fn(state);
  for (const l of listeners) l();
};
export const useCompose = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

/** A fresh draft: when the composer opens and after it closes or posts. */
export function resetComposer() {
  for (const p of state.photos) {
    p.abort?.abort();
    URL.revokeObjectURL(p.preview);
  }
  setCompose(() => blank());
}

export const patchDraft = (
  d: Partial<ComposeState['draft']>,
  clear?: keyof DraftErrors,
) =>
  setCompose((s) => {
    const errors = { ...s.errors };
    if (clear) delete errors[clear];
    return { ...s, draft: { ...s.draft, ...d }, errors };
  });
export const patchPhoto = (key: string, p: Partial<Photo>) =>
  setCompose((s) => ({
    ...s,
    photos: s.photos.map((x) => (x.key === key ? { ...x, ...p } : x)),
  }));

let seq = 0;
export function startUpload(photo: Photo) {
  const abort = new AbortController();
  patchPhoto(photo.key, { state: { status: 'uploading', progress: 0 }, abort });
  // The upload code comes with the composer's screen, already loaded by the time a photo is added.
  import('./data')
    .then(({ uploadPhoto }) =>
      uploadPhoto(
        photo.file,
        (progress) => {
          const cur = state.photos.find((p) => p.key === photo.key);
          if (cur?.state.status === 'uploading')
            patchPhoto(photo.key, { state: { status: 'uploading', progress } });
        },
        abort.signal,
      ),
    )
    .then((url) =>
      patchPhoto(photo.key, {
        state: { status: 'done', url },
        abort: undefined,
      }),
    )
    .catch((err: unknown) => {
      if (!state.photos.some((p) => p.key === photo.key)) return;
      // The API refused its type or size: trying again won't help, so the photo goes and the reason is said.
      // Checked by name, not class: the store stays free of the upload code (it loads with the app's first code).
      const refused = err as { name?: string; problem?: UploadProblem };
      if (refused.name === 'UploadRefused' && refused.problem) {
        const problem = refused.problem;
        removePhoto(photo.key);
        setCompose((s) => ({
          ...s,
          refused: { name: photo.file.name, problem },
        }));
        return;
      }
      patchPhoto(photo.key, {
        state: { status: 'failed' },
        abort: undefined,
      });
    });
}
/** Adds and uploads photos; `refused` is a picked file the composer's check turned away, said under the photos. */
export function addPhotos(files: File[], refused: RefusedPhoto | null = null) {
  const fine = files.filter((f) => f.type.startsWith('image/'));
  const added = fine.map<Photo>((file) => ({
    key: `foto-${++seq}`,
    file,
    preview: URL.createObjectURL(file),
    state: { status: 'uploading', progress: 0 },
  }));
  setCompose((s) => ({ ...s, photos: [...s.photos, ...added], refused }));
  added.forEach(startUpload);
}
export function removePhoto(key: string) {
  const p = state.photos.find((x) => x.key === key);
  p?.abort?.abort();
  if (p) URL.revokeObjectURL(p.preview);
  setCompose((s) => ({ ...s, photos: s.photos.filter((x) => x.key !== key) }));
}

/** The share target's title, text and images, once per opening (today's `getSharedData`). */
let sharedTaken = false;
export function takeShared() {
  if (sharedTaken) return;
  sharedTaken = true;
  void getSharedData()
    .then((shared) => {
      if (!shared) return;
      const body = [shared.text, shared.url].filter(Boolean).join('\n');
      patchDraft({
        title: (shared.title ?? '').slice(0, MAX_TITLE),
        body: body.slice(0, MAX_BODY),
      });
      if (shared.images?.length)
        addPhotos(
          shared.images.map(
            (i) => new File([i.data], i.name, { type: i.type }),
          ),
        );
    })
    .catch(() => undefined);
}
export function composerOpened() {
  resetComposer();
  sharedTaken = false;
}
