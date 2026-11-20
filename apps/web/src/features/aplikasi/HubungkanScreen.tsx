import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { ApiError, type OAuthScope } from '~/api/generated';
import * as api from '~/api/generated/operations';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Item,
  NoteBox,
  Radio,
  RuledList,
  Skeleton,
  SkeletonRow,
  Tile,
  toast,
} from '~/components/garis';
import { IconKunci } from '~/components/icons/kunci';
import { IconLayanan } from '~/components/icons/layanan';
import { PageBody, PageTitle } from '~/components/shell/page';
import { hubungkan as copy } from '~/copy/hubungkan';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { consentRequestQuery } from './data';
import { appName } from './name';

/** Leaves PIPS! for the app's own address (tests replace it). */
export const leaveFor = { go: (url: string) => window.location.assign(url) };

function Expired() {
  return (
    <EmptyState
      title={copy.habis}
      text={copy.habisIsi}
      action={
        <Button variant="paper" size="sm" asChild>
          <Link to="/" replace>
            {copy.keBeranda}
          </Link>
        </Button>
      }
    />
  );
}

/**
 * The consent page (`/hubungkan?permintaan=…`): an app asks to use PIPS! as the member, through MCP. It names the
 * app as plain text and where the browser returns, says what it may do, and offers Izinkan and Tolak. When the app
 * asks to change things too, the member chooses Baca dan ubah or Hanya baca; the API grants no more than that. A
 * focused flow. Either choice sends the browser back to the app.
 */
export function HubungkanScreen({ requestId }: { requestId?: string }) {
  const request = useQuery({
    ...consentRequestQuery(requestId ?? ''),
    enabled: !!requestId,
  });
  const [leaving, setLeaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const choiceName = useId();
  const decide = useMutation({
    mutationFn: ({
      approve,
      scopes,
    }: {
      approve: boolean;
      scopes: OAuthScope[];
    }) =>
      approve
        ? api.approveOAuthRequest({
            requestId: requestId ?? '',
            requestBody: { scopes },
          })
        : api.denyOAuthRequest({ requestId: requestId ?? '' }),
    onSuccess: ({ redirectTo }) => {
      setLeaving(true);
      leaveFor.go(redirectTo);
    },
    onError: () => toast.error(copy.gagal),
  });
  const gone =
    !requestId ||
    (request.error instanceof ApiError && request.error.status === 404) ||
    (decide.error instanceof ApiError && decide.error.status === 404);

  if (gone) {
    return (
      <PageBody className="gap-5">
        <PageTitle className="disp">{common.shell.hubungkanAplikasi}</PageTitle>
        <Expired />
      </PageBody>
    );
  }
  if (request.isError) {
    return (
      <PageBody className="gap-5">
        <PageTitle className="disp">{common.shell.hubungkanAplikasi}</PageTitle>
        <ErrorState
          title={copy.gagalMuat}
          onRetry={() => void request.refetch()}
          retrying={request.isFetching}
        />
      </PageBody>
    );
  }
  if (!request.data) {
    return (
      <PageBody className="gap-5">
        <PageTitle className="disp">{common.shell.hubungkanAplikasi}</PageTitle>
        <Skeleton>
          {[0, 1].map((i) => (
            <SkeletonRow key={i} lines={['40%', '70%']} />
          ))}
        </Skeleton>
      </PageBody>
    );
  }

  const { clientName, redirectHost, scopes } = request.data;
  const busy = decide.isPending || leaving;
  const writeAsked = scopes.includes('pips.write');
  const choose = (approve: boolean) => {
    if (busy) return;
    decide.mutate({
      approve,
      scopes:
        writeAsked && !readOnly ? ['pips.read', 'pips.write'] : ['pips.read'],
    });
  };
  const choice = (value: boolean, title: string, line: string) => (
    <Radio
      name={choiceName}
      checked={readOnly === value}
      disabled={busy}
      onChange={() => setReadOnly(value)}
    >
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block t-sub">{title}</span>
        <span className="block t-cap text-fg-2">{line}</span>
      </span>
    </Radio>
  );
  return (
    <PageBody className="gap-5">
      <div className="grid gap-1.5">
        <PageTitle className="disp">
          {fill(copy.judul, { nama: appName(clientName) })}
        </PageTitle>
        <p className="t-body text-fg-2">
          {fill(copy.kembaliKe, { host: redirectHost })}
        </p>
      </div>
      {writeAsked ? (
        <fieldset className="g-opts" aria-label={copy.bolehLabel}>
          {choice(false, copy.bacaUbah, copy.bacaUbahIsi)}
          {choice(true, copy.hanyaBaca, copy.hanyaBacaIsi)}
        </fieldset>
      ) : (
        <Card className="px-4 py-1">
          <RuledList aria-label={copy.bolehLabel}>
            <li>
              <Item center>
                <Tile>
                  <IconLayanan size={20} />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block t-sub">{copy.baca}</span>
                  <span className="block t-cap text-fg-2">{copy.bacaIsi}</span>
                </span>
              </Item>
            </li>
          </RuledList>
        </Card>
      )}
      <NoteBox icon={<IconKunci size={20} />}>{copy.aksesmu}</NoteBox>
      <div className="grid gap-2">
        <Button
          variant="gold"
          aria-disabled={busy || undefined}
          onClick={() => choose(true)}
        >
          {busy && decide.variables?.approve === true
            ? copy.mengalihkan
            : copy.izinkan}
        </Button>
        <Button
          variant="ghost"
          aria-disabled={busy || undefined}
          onClick={() => choose(false)}
        >
          {busy && decide.variables?.approve === false
            ? copy.mengalihkan
            : copy.tolak}
        </Button>
      </div>
    </PageBody>
  );
}
