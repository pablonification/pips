import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  ApiError,
  type ManageForm,
  type ProfileField,
  type UpdateForm,
} from '~/api/generated';
import { keepForm, updateForm } from './queries';
import {
  canSave,
  inFieldOrder,
  toItems,
  toSections,
  type BuilderItem,
} from './rules';

/** What the Pertanyaan tab edits: one form state for the whole page, so a tab switch keeps every edit. */
export interface BuilderValues {
  title: string;
  description: string;
  items: BuilderItem[];
  requestedFields: ProfileField[];
}

export const valuesOf = (f: ManageForm): BuilderValues => ({
  title: f.title,
  description: f.description ?? '',
  items: toItems(f.sections),
  requestedFields: inFieldOrder(f.requestedFields),
});

type Saved = Required<
  Pick<UpdateForm, 'title' | 'description' | 'sections' | 'requestedFields'>
>;
const payloadOf = (v: BuilderValues): Saved => ({
  title: v.title,
  description: v.description.trim() ? v.description : null,
  sections: toSections(v.items),
  requestedFields: inFieldOrder(v.requestedFields),
});
const KEYS = ['title', 'description', 'sections', 'requestedFields'] as const;

export type SaveState = 'saved' | 'saving' | 'error';

/** The server refused an edit that loses answers until the maker agrees (409). */
export interface BreakingRefusal {
  breaking: { questionId: string; label: string; change: 'removed' | 'type' }[];
  responseCount: number;
}

const QUIET_MS = 600;

/**
 * The builder's state and its autosave. Every change is sent about 600 ms after the last key, one request at a
 * time, only the parts that changed (title, description, sections, requested fields). An edit the maker already
 * agreed to lose answers for (`agreeBreaking`) goes with `confirmBreaking`. A 409 the builder didn't foresee (an
 * answer came in meanwhile) comes back as `refusal`: `resolveRefusal(true)` sends it again agreed, false puts the
 * questions back as the server has them. A list that can't be saved yet (an option written twice) waits.
 */
export function useBuilder(form: ManageForm, editable: boolean) {
  const client = useQueryClient();
  const methods = useForm<BuilderValues>({ defaultValues: valuesOf(form) });
  const values = useWatch({ control: methods.control });
  const [state, setState] = useState<SaveState>('saved');
  const [refusal, setRefusal] = useState<BreakingRefusal | null>(null);
  // Everything the saving needs lives in one ref, so a save started before a render finishes against the latest.
  const r = useRef({
    saved: payloadOf(valuesOf(form)),
    server: form,
    agreed: false,
    refusing: false,
    inFlight: null as Promise<void> | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  }).current;

  const changes = (): UpdateForm | null => {
    const v = methods.getValues();
    if (!canSave(v.items)) return null;
    const next = payloadOf(v);
    const body: UpdateForm = {};
    for (const k of KEYS)
      if (JSON.stringify(next[k]) !== JSON.stringify(r.saved[k]))
        Object.assign(body, { [k]: next[k] });
    return Object.keys(body).length ? body : null;
  };

  const schedule = () => {
    clearTimeout(r.timer);
    r.timer = setTimeout(() => void send(), QUIET_MS);
  };

  async function send(confirm = false): Promise<void> {
    while (r.inFlight) await r.inFlight;
    if (r.refusing && !confirm) return;
    const body = changes();
    if (!body) {
      setState('saved');
      return;
    }
    if (r.agreed || confirm) body.confirmBreaking = true;
    setState('saving');
    r.inFlight = (async () => {
      try {
        const kept = await updateForm(form.id, body);
        for (const k of KEYS)
          if (k in body) Object.assign(r.saved, { [k]: body[k] });
        if (body.confirmBreaking) r.agreed = false;
        r.server = kept;
        keepForm(client, kept);
        setState('saved');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && e.body?.breaking) {
          r.refusing = true;
          setRefusal({
            breaking: e.body.breaking,
            responseCount: e.body.responseCount,
          });
        } else setState('error');
      }
    })();
    await r.inFlight;
    r.inFlight = null;
    if (!r.refusing && changes()) schedule();
  }

  useEffect(() => {
    if (!editable || r.refusing) return;
    if (changes()) {
      setState((s) => (s === 'error' ? s : 'saving'));
      schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, editable]);

  // Leaving the page sends what is still waiting.
  useEffect(
    () => () => {
      clearTimeout(r.timer);
      if (editable && !r.refusing && changes()) void send();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    methods,
    state,
    retry: () => void send(),
    /** Sends what is waiting now; resolves once the server has it (Terbitkan, Pratinjau). */
    flush: async () => {
      clearTimeout(r.timer);
      await send();
    },
    /** The next save loses answers the maker agreed to lose. */
    agreeBreaking: () => {
      r.agreed = true;
    },
    refusal,
    resolveRefusal: (agree: boolean) => {
      setRefusal(null);
      r.refusing = false;
      if (agree) {
        void send(true);
        return;
      }
      methods.setValue('items', toItems(r.server.sections));
      r.saved.sections = toSections(toItems(r.server.sections));
      if (!changes()) setState('saved');
    },
  };
}

export type Builder = ReturnType<typeof useBuilder>;
