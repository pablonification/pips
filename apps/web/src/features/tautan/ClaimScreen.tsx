import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import {
  ApiError,
  type ShortLinkClaimLocked,
  type ShortLinkClaimLookup,
  type ShortLinkClaimWrong,
} from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  RuledList,
  Skeleton,
  SkeletonRow,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconCentang2 } from '~/components/icons/centang2';
import { IconKunci } from '~/components/icons/kunci';
import { IconPendek } from '~/components/icons/pendek';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { tautan as copy } from '~/copy/tautan';
import { useNow } from '~/hooks/useNow';
import { useOnline } from '~/hooks/useOnline';
import { hm } from '~/lib/dates';
import { Address, FieldError, SlState } from './parts';
import {
  lookUpClaim,
  markFresh,
  myLinksQuery,
  refreshAll,
  takeClaim,
} from './queries';
import {
  bareUrl,
  dayMonthYearLong,
  lockedWords,
  whenDay,
  wrongWords,
} from './rules';
import './tautan.css';

type Step =
  | { kind: 'form' }
  | { kind: 'ended' }
  | { kind: 'done'; ids: string[] }
  | ({ kind: 'answer' } & ShortLinkClaimLookup);

const a = copy.ambil;

/**
 * Ambil tautan lama: the old s.hmif.dev username (or email) and password, then the links that would move, then
 * "Jadikan milikku". Every other answer is a state of its own: the account's links taken by someone else (never who),
 * none, already yours, two-step sign-in (an admin moves them). Five wrong tries lock it for 15 minutes.
 */
export function ClaimScreen() {
  const client = useQueryClient();
  const navigate = useNavigate();
  // The list's first page says whether claiming is open, and until when.
  const online = useOnline();
  const list = useInfiniteQuery(myLinksQuery());
  const claim = list.data?.pages[0]?.claim;
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const heading = useRef<HTMLHeadingElement>(null);
  const toList = (ids: string[] = []) => {
    markFresh(ids);
    void navigate({ to: '/layanan/tautan' });
  };

  useEffect(() => {
    if (step.kind !== 'form') heading.current?.focus();
  }, [step]);

  let inner;
  if (!claim && (list.isError || !online))
    inner = (
      <ErrorState
        title={copy.daftar.gagal}
        text={online ? undefined : copy.daftar.periksaKoneksi}
        onRetry={() => void list.refetch()}
        retrying={online && list.isFetching}
      />
    );
  else if (!claim)
    inner = (
      <Skeleton label={copy.daftar.memuat}>
        <SkeletonRow lines={['80%']} />
        <SkeletonRow lines={['40%', '100%']} />
      </Skeleton>
    );
  else if (!claim.open || step.kind === 'ended')
    inner = (
      <EmptyState
        title={a.berakhir}
        action={
          <Button variant="gold" asChild>
            <Link to="/layanan/tautan">{a.lihatTautanku}</Link>
          </Button>
        }
      />
    );
  else if (step.kind === 'form')
    inner = (
      <ClaimForm
        until={claim.until}
        onAnswer={(r) => setStep({ kind: 'answer', ...r })}
        onEnded={() => setStep({ kind: 'ended' })}
      />
    );
  else if (step.kind === 'done')
    inner = (
      <SlState
        done
        gold
        icon={<IconCentang size={24} />}
        title={fill(a.selesai, { jumlah: step.ids.length })}
        titleRef={heading}
      >
        <Button variant="gold" onClick={() => toList(step.ids)}>
          {a.lihatTautanku}
        </Button>
      </SlState>
    );
  else
    inner = (
      <Answer
        answer={step}
        headingRef={heading}
        onAgain={() => setStep({ kind: 'form' })}
        onMine={() => toList()}
        onTaken={(ids) => {
          void refreshAll(client);
          setStep({ kind: 'done', ids });
        }}
        onEnded={() => setStep({ kind: 'ended' })}
      />
    );

  return (
    <>
      <DeskHead title={common.shell.ambilTautanLama} />
      <PageBody className="gap-[18px]">
        <div className="sl-claim">{inner}</div>
      </PageBody>
    </>
  );
}

function ClaimForm({
  until,
  onAnswer,
  onEnded,
}: {
  until: string | null;
  onAnswer: (r: ShortLinkClaimLookup) => void;
  onEnded: () => void;
}) {
  const id = useId();
  const now = useNow(15_000);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const locked = !!lockedUntil && Date.parse(lockedUntil) > now;
  const shown = locked ? lockedWords(lockedUntil!) : error;

  const submit = async () => {
    if (busy || locked) return;
    if (!login.trim() || !password) {
      setError(a.isiKeduanya);
      return (login.trim() ? passRef : userRef).current?.focus();
    }
    setBusy(true);
    try {
      const r = await lookUpClaim(login.trim(), password);
      onAnswer(r);
    } catch (e) {
      setPassword('');
      if (e instanceof ApiError && e.status === 401) {
        setError(wrongWords((e.body as ShortLinkClaimWrong).triesLeft));
      } else if (e instanceof ApiError && e.status === 429) {
        const until = (e.body as Partial<ShortLinkClaimLocked> | undefined)
          ?.until;
        if (until) {
          setLockedUntil(until);
          setError(null);
        } else setError(a.sibuk);
      } else if (e instanceof ApiError && e.status === 410) {
        return onEnded();
      } else setError(a.gagal);
      passRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="t-sm text-fg-2">
        {a.untuk}
        {until
          ? ` ${fill(a.bisaSampai, { tanggal: dayMonthYearLong(until) })}`
          : ''}
      </p>
      <form
        className="sl-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="sl-fld">
          <label className="t-label strong" htmlFor={`${id}-u`}>
            {a.pengguna}
          </label>
          <input
            ref={userRef}
            className="g-field"
            id={`${id}-u`}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            aria-invalid={shown ? true : undefined}
            aria-describedby={shown ? `${id}-e` : undefined}
          />
        </div>
        <div className="sl-fld">
          <label className="t-label strong" htmlFor={`${id}-p`}>
            {a.sandi}
          </label>
          <input
            ref={passRef}
            className="g-field"
            id={`${id}-p`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={shown ? true : undefined}
            aria-describedby={shown ? `${id}-e` : undefined}
          />
        </div>
        {shown ? (
          <div role="alert">
            <FieldError id={`${id}-e`}>{shown}</FieldError>
          </div>
        ) : null}
        <p className="sl-note t-cap text-fg-3">
          <IconKunci size={16} />
          <span>{a.tidakDisimpan}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="gold"
            type="submit"
            aria-disabled={busy || locked || undefined}
          >
            {busy ? a.mencari : a.cari}
          </Button>
        </div>
      </form>
      <p className="t-cap text-fg-3">{a.lupa}</p>
    </>
  );
}

function Answer({
  answer,
  headingRef,
  onAgain,
  onMine,
  onTaken,
  onEnded,
}: {
  answer: ShortLinkClaimLookup;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAgain: () => void;
  onMine: () => void;
  onTaken: (ids: string[]) => void;
  onEnded: () => void;
}) {
  const now = useNow(60_000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const again = (
    <Button variant="paper" onClick={onAgain}>
      {a.cobaAkunLain}
    </Button>
  );
  const mine = (
    <Button variant="gold" onClick={onMine}>
      {a.lihatTautanku}
    </Button>
  );

  if (answer.state === 'found')
    return (
      <>
        <h2 className="t-title" ref={headingRef} tabIndex={-1}>
          {fill(a.ditemukan, { jumlah: answer.links.length })}
        </h2>
        <p className="t-sm text-fg-2">
          {a.dariAkun} <b className="strong text-fg">{answer.account}</b>.
        </p>
        <RuledList className="sl-list sl-claim-list">
          {answer.links.map((l, i) => (
            <li
              key={l.id}
              className="sl-row"
              style={{ '--i': i } as React.CSSProperties}
            >
              <span className="sl-main">
                <span className="sl-txt">
                  <span className="sl-addr block">
                    <Address name={l.name} />
                  </span>
                  <span className="sl-ell t-cap text-fg-2">
                    {bareUrl(l.destination ?? '')}
                  </span>
                </span>
                <span className="sl-n">
                  <b>{l.clicks.toLocaleString('id-ID')}</b>
                  <span>{copy.daftar.klik}</span>
                </span>
              </span>
            </li>
          ))}
        </RuledList>
        {error ? (
          <div role="alert">
            <FieldError id="sl-claim-e">{error}</FieldError>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="gold"
            aria-disabled={busy || undefined}
            onClick={async () => {
              if (busy || !answer.token) return;
              setBusy(true);
              try {
                await takeClaim(answer.token);
                onTaken(answer.links.map((l) => l.id));
              } catch (e) {
                const status = e instanceof ApiError ? e.status : 0;
                if (status === 410) return onEnded();
                setError(
                  status === 409
                    ? a.keduluan
                    : status === 400
                      ? a.kedaluwarsa
                      : a.gagal,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? a.memindahkan : a.jadikanMilikku}
          </Button>
          <Button variant="paper" onClick={onAgain}>
            {a.bukanAkunku}
          </Button>
        </div>
      </>
    );
  if (answer.state === 'taken')
    return (
      <SlState
        icon={<IconKunci size={24} />}
        title={a.diambil}
        titleRef={headingRef}
        text={
          answer.claimedAt
            ? fill(a.diambilIsi, {
                hari: whenDay(answer.claimedAt, now),
                waktu: hm(answer.claimedAt),
              })
            : undefined
        }
      >
        {again}
      </SlState>
    );
  if (answer.state === 'empty')
    return (
      <SlState
        icon={<IconPendek size={24} />}
        title={a.kosong}
        titleRef={headingRef}
      >
        {again}
      </SlState>
    );
  if (answer.state === 'mine')
    return (
      <SlState
        icon={<IconCentang2 size={24} />}
        title={a.milikmu}
        titleRef={headingRef}
      >
        {mine}
        {again}
      </SlState>
    );
  return (
    <SlState
      icon={<IconKunci size={24} />}
      title={a.duaLangkah}
      titleRef={headingRef}
      text={a.duaLangkahIsi}
    >
      {again}
    </SlState>
  );
}
