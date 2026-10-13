import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { currentCoursesQuery, userAcademicQuery } from '~/api/queries';
import type { UserWithRoles } from '~/api/generated';
import {
  Button,
  ConfirmDialog,
  Disclosure,
  ErrorState,
  FactsList,
  HmifLogo,
  Item,
  OfflineBanner,
  Plaque,
  RowButton,
  RuledList,
  Seg,
  SkeletonBar,
  Tile,
  toast,
} from '~/components/garis';
import { IconGelap } from '~/components/icons/gelap';
import { IconKeluar } from '~/components/icons/keluar';
import { IconKredit } from '~/components/icons/kredit';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLonceng } from '~/components/icons/lonceng';
import { IconMatkul } from '~/components/icons/matkul';
import { IconPasang } from '~/components/icons/pasang';
import { IconSistem } from '~/components/icons/sistem';
import { IconTerang } from '~/components/icons/terang';
import { pushStatusWords, usePushState } from '~/components/push';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { profil as copy } from '~/copy/profil';
import useLogout from '~/hooks/auth/useLogout';
import useSession from '~/hooks/auth/useSession';
import { useTheme } from '~/lib/theme/useTheme';
import { openInstallSheet } from './install-store';
import { angkatanQuery, groupsQuery } from './queries';
import {
  angkatanLabel,
  groupsFact,
  programName,
  semesterLabel,
  totalSks,
} from './rules';
import { jamWib, useOnline } from './useOnline';

/** The member card (garis/screens-more.js `memberCard`): status, name, NIM, programme and angkatan, the logo. */
export function MemberCard({ me }: { me: UserWithRoles }) {
  const angkatan = useQuery(angkatanQuery());
  return (
    <Plaque
      className="g-member"
      role="figure"
      aria-label={fill(copy.kartu.label, { nama: me.fullName, nim: me.nim })}
    >
      <div className="g-m-top">
        <p className="t-cap strong">{me.membershipStatus}</p>
        <HmifLogo width={72} plate />
      </div>
      <div className="g-m-id">
        <p className="g-m-name disp">{me.fullName}</p>
        <p className="g-m-nim code">{me.nim}</p>
      </div>
      <div className="g-m-foot">
        <span>{programName(me.major)}</span>
        <span>{angkatanLabel(me.major, me.angkatan, angkatan.data)}</span>
      </div>
    </Plaque>
  );
}

function SettingRow({
  icon,
  title,
  sub,
  to,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  sub?: ReactNode;
  to?: '/profil/matkul' | '/profil/notifikasi' | '/profil/kredit';
  onClick?: () => void;
}) {
  const inner = (
    <Item center>
      <Tile>{icon}</Tile>
      <span className="min-w-0 grow">
        <span className="block t-sub">{title}</span>
        {sub ? <span className="block t-cap text-fg-2">{sub}</span> : null}
      </span>
      <span className="g-chev">
        <IconLanjut size={18} />
      </span>
    </Item>
  );
  return (
    <li>
      {to ? (
        <RowButton asChild>
          <Link to={to}>{inner}</Link>
        </RowButton>
      ) : (
        <RowButton onClick={onClick}>{inner}</RowButton>
      )}
    </li>
  );
}

function PushRowState() {
  const { status } = usePushState();
  if (status === null) return <SkeletonBar width="60%" />;
  const { text, tone } = pushStatusWords(status);
  return (
    <>
      <span
        aria-hidden="true"
        className={
          tone === 'success'
            ? 'text-success'
            : tone === 'danger'
              ? 'text-danger'
              : 'text-fg-3'
        }
      >
        ■
      </span>{' '}
      {text}
    </>
  );
}

/** Keluar (garis/screens-more.js `OV.confirm` logout): a sheet on phones, a centred panel on tablets, a dialog on desktop. */
function Keluar() {
  const [open, setOpen] = useState(false);
  const { logoutAsync, isPending } = useLogout();
  const run = async () => {
    if (isPending) return;
    try {
      await logoutAsync();
      // The session provider takes the signed-out member to sign-in.
    } catch {
      setOpen(false);
      toast.error(copy.keluar.gagal, {
        action: {
          label: common.actions.cobaLagi,
          onClick: () => setOpen(true),
        },
      });
    }
  };
  return (
    <>
      <Button
        variant="danger-ghost"
        className="justify-self-center"
        onClick={() => setOpen(true)}
      >
        <IconKeluar size={20} />
        {copy.keluar.tombol}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          if (!isPending) setOpen(o);
        }}
        title={copy.keluar.judul}
        cancelLabel={copy.keluar.batal}
        confirmLabel={isPending ? copy.keluar.keluarProses : copy.keluar.tombol}
        danger
        onConfirm={() => void run()}
      >
        {copy.keluar.isi}
      </ConfirmDialog>
    </>
  );
}

/**
 * Profil (garis/screens-more.js `scrProfil`): the member card, Informasi akun folded, the setting rows, Keluar
 * centred; on desktop the card and Informasi akun on the left, the rows and Keluar on the right (`.prof-grid`).
 */
export function ProfilScreen() {
  const me = useSession();
  const academic = useQuery(userAcademicQuery());
  const groups = useQuery({ ...groupsQuery(), enabled: me.roles.length > 0 });
  const courses = useQuery(currentCoursesQuery());
  const online = useOnline();
  const { preference, setPreference } = useTheme();

  const grup = groupsFact(me.roles, groups.data);
  const facts: [string, string][] = [
    [copy.info.email, me.email],
    [copy.info.program, programName(me.major)],
    [copy.info.kampus, me.region],
  ];
  if (academic.data)
    facts.push([
      copy.info.semester,
      academic.data.semester
        ? fill(copy.info.semesterNilai, {
            semester: academic.data.semester,
            label: semesterLabel(academic.data),
          })
        : semesterLabel(academic.data),
    ]);
  if (grup) facts.push([copy.info.grup, grup]);

  const failed = [academic, courses, groups].filter((q) => q.isError);
  const coursesSub = courses.data ? (
    fill(copy.baris.mataKuliahkuIsi, {
      jumlah: courses.data.length,
      sks: totalSks(courses.data),
    })
  ) : courses.isError ? null : (
    <SkeletonBar width="45%" />
  );

  return (
    <>
      <DeskHead title={common.nav.profil} />
      <PageBody wide className="g-prof-grid gap-5 lg:gap-10">
        {!online ? (
          <OfflineBanner
            className="lg:col-span-2"
            updatedAt={jamWib(courses.dataUpdatedAt || Date.now())}
          />
        ) : null}
        <div className="grid gap-5 lg:gap-4">
          <MemberCard me={me} />
          <Disclosure label={copy.info.judul}>
            <FactsList facts={facts} />
          </Disclosure>
        </div>
        <div className="grid gap-5 lg:max-w-[520px] lg:gap-3">
          <RuledList>
            <SettingRow
              icon={<IconMatkul size={20} />}
              title={copy.baris.mataKuliahku}
              sub={coursesSub}
              to="/profil/matkul"
            />
            <SettingRow
              icon={<IconLonceng size={20} />}
              title={copy.baris.notifikasi}
              sub={<PushRowState />}
              to="/profil/notifikasi"
            />
            <li>
              <Item center className="flex-wrap">
                <Tile>
                  <IconSistem size={20} />
                </Tile>
                <span className="grow t-sub">{copy.baris.tampilan}</span>
                <Seg
                  full
                  label={copy.baris.tampilanLabel}
                  value={preference}
                  onChange={setPreference}
                  options={[
                    {
                      value: 'system',
                      label: copy.baris.sistem,
                      icon: <IconSistem size={16} />,
                    },
                    {
                      value: 'light',
                      label: copy.baris.terang,
                      icon: <IconTerang size={16} />,
                    },
                    {
                      value: 'dark',
                      label: copy.baris.gelap,
                      icon: <IconGelap size={16} />,
                    },
                  ]}
                />
              </Item>
            </li>
            <SettingRow
              icon={<IconPasang size={20} />}
              title={copy.baris.pasang}
              onClick={openInstallSheet}
            />
            <SettingRow
              icon={<IconKredit size={20} />}
              title={copy.baris.kredit}
              to="/profil/kredit"
            />
          </RuledList>
          {failed.length ? (
            <ErrorState
              onRetry={() => failed.forEach((q) => void q.refetch())}
              retrying={failed.some((q) => q.isFetching)}
            />
          ) : null}
          <Keluar />
        </div>
      </PageBody>
    </>
  );
}
