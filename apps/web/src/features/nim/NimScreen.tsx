import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { api } from '~/api/client';
import type { NimFinderResult } from '~/api/generated';
import {
  Avatar,
  ErrorState,
  RowButton,
  RuledList,
  Searchbox,
  toast,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { nim as copy } from '~/copy/nim';
import { testi } from '~/copy/testi';
import { DEBOUNCE_TIME } from '~/lib/constants';
import { serviceById } from '~/lib/services';
import { initialsOf } from '~/lib/shell/names';
import {
  useDebounced,
  useOnline,
  useUrlText,
} from '~/features/layanan-svc/parts';
import { nimQuery, nimStatus, rankMembers, type NimPhase } from './rules';

const route = getRouteApi('/_app/_left-navbar/layanan/nim/');

async function copyNim(m: NimFinderResult) {
  try {
    await navigator.clipboard.writeText(m.nim);
    toast.success(fill(copy.disalin, { nim: m.nim }));
  } catch {
    toast.error(fill(copy.gagalSalin, { nim: m.nim }));
  }
}

function MemberRow({ m }: { m: NimFinderResult }) {
  return (
    <li>
      <RowButton
        aria-label={fill(copy.salinLabel, { nim: m.nim, nama: m.fullName })}
        onClick={() => void copyNim(m)}
      >
        <span className="g-svc-row">
          <Avatar initials={initialsOf(m.fullName)} />
          <span className="min-w-0 flex-1">
            <span className="block t-sub">{m.fullName}</span>
            <span className="block t-cap text-fg-2">
              {testi.program[m.major]}
            </span>
          </span>
          <span className="t-label code">{m.nim}</span>
        </span>
      </RowButton>
    </li>
  );
}

/**
 * NIM Finder (garis/screens-more.js `scrNim`, `nimResults`): search members by name or NIM from 3 characters, once
 * typing pauses; pick a row to copy the NIM. The query lives in the URL (`q`), so search's "Orang" and any link can
 * open it filled in, and reload keeps it.
 */
export function NimScreen() {
  const { q: urlQ } = route.useSearch();
  const navigate = route.useNavigate();
  const online = useOnline();
  const [typed, setTyped] = useUrlText(urlQ, (q) => {
    void navigate({ search: (prev) => ({ ...prev, q }), replace: true });
  });
  const settledTyped = useDebounced(typed, DEBOUNCE_TIME);
  const q = nimQuery(settledTyped);
  const results = useQuery({
    queryKey: ['nim', q],
    queryFn: () => api.userFinder.getUser({ search: q! }),
    enabled: !!q,
    select: (rows) => rankMembers(rows, q ?? ''),
  });

  const pending = nimQuery(typed) !== q;
  const failed =
    !!q && !pending && !results.data && (results.isError || !online);
  const phase: NimPhase = !nimQuery(typed)
    ? { kind: 'short' }
    : failed
      ? { kind: 'error' }
      : pending || !results.data
        ? { kind: 'loading' }
        : { kind: 'done', count: results.data.length, typed: settledTyped };

  return (
    <>
      <DeskHead title={serviceById('nim').label} />
      <PageBody className="gap-3">
        <Searchbox
          label={copy.cariLabel}
          placeholder={copy.placeholder}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <p className="t-cap text-fg-3" role="status">
          {nimStatus(phase)}
        </p>
        {phase.kind === 'error' ? (
          <ErrorState
            title={copy.gagal}
            text={online ? undefined : copy.periksaKoneksi}
            onRetry={() => void results.refetch()}
            retrying={online && results.isFetching}
          />
        ) : null}
        {phase.kind === 'done' && results.data?.length ? (
          <RuledList>
            {results.data.map((m) => (
              <MemberRow key={m.nim} m={m} />
            ))}
          </RuledList>
        ) : null}
      </PageBody>
    </>
  );
}
