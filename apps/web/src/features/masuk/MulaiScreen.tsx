import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSyncExternalStore, type ReactNode } from 'react';
import { currentCoursesQuery } from '~/api/queries';
import {
  Button,
  Card,
  Item,
  RuledList,
  SkeletonBar,
  Tag,
  Tile,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconLonceng } from '~/components/icons/lonceng';
import { IconMatkul } from '~/components/icons/matkul';
import { IconPasang } from '~/components/icons/pasang';
import {
  openPushPrompt,
  pushStatusWords,
  usePushState,
} from '~/components/push';
import { PageBody, PageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { mulai as copy } from '~/copy/mulai';
import { profil } from '~/copy/profil';
import useSession from '~/hooks/auth/useSession';
import {
  currentInstallWay,
  installStore,
  openInstallSheet,
} from '~/features/profil/install-store';
import { totalSks } from '~/features/profil/rules';
import { writeFirstRunFlag, type FirstRunFlag } from './first-run';

function Step({
  icon,
  gold,
  title,
  sub,
  done,
  action,
}: {
  icon: ReactNode;
  gold?: boolean;
  title: string;
  sub?: ReactNode;
  done: boolean;
  action?: ReactNode;
}) {
  return (
    <li>
      <Item center>
        <Tile gold={gold && !done}>{icon}</Tile>
        <span className="min-w-0 flex-1">
          <span className="block t-sub">{title}</span>
          {sub ? <span className="block t-cap text-fg-2">{sub}</span> : null}
        </span>
        {done ? (
          <Tag tone="success" icon={<IconCentang size={16} />}>
            {copy.selesai}
          </Tag>
        ) : (
          action
        )}
      </Item>
    </li>
  );
}

/**
 * First run (`/mulai`; SPEC stories 5–7, no locked design): this semester's courses, notifications on this device,
 * and, when not installed, Pasang PIPS!. Built from Beranda's "Perlu ditindaklanjuti" rows. Ke Beranda and Lewati
 * both remember the answer on this device.
 */
export function MulaiScreen() {
  const me = useSession();
  const navigate = useNavigate();
  const courses = useQuery(currentCoursesQuery());
  const { status } = usePushState();
  useSyncExternalStore(installStore.subscribe, installStore.get);
  const installWay = currentInstallWay();

  const leave = (flag: FirstRunFlag) => {
    writeFirstRunFlag(localStorage, flag);
    void navigate({ to: '/', replace: true });
  };

  const coursesDone = !!courses.data?.length;
  const pushDone = status === 'aktif';
  const pushWords = status && !pushDone ? pushStatusWords(status) : null;

  return (
    <PageBody className="gap-5">
      <div className="grid gap-1.5">
        <PageTitle className="disp">
          {fill(common.shell.halo, { nama: me.fullName.split(' ')[0] })}
        </PageTitle>
        <p className="t-body text-fg-2">{copy.isi}</p>
      </div>
      <Card className="px-4 py-1">
        <RuledList aria-label={copy.langkah}>
          <Step
            icon={<IconMatkul size={20} />}
            gold
            title={copy.matkul}
            done={coursesDone}
            sub={
              courses.data ? (
                coursesDone ? (
                  fill(profil.baris.mataKuliahkuIsi, {
                    jumlah: courses.data.length,
                    sks: totalSks(courses.data),
                  })
                ) : (
                  copy.matkulIsi
                )
              ) : (
                <SkeletonBar width="50%" />
              )
            }
            action={
              <Button variant="gold" size="sm" asChild>
                <Link to="/profil/matkul/tambah" search={{ dari: 'mulai' }}>
                  {copy.atur}
                </Link>
              </Button>
            }
          />
          <Step
            icon={<IconLonceng size={20} />}
            title={pushDone ? copy.notifMenyala : copy.notif}
            done={pushDone}
            sub={
              status === null ? (
                <SkeletonBar width="40%" />
              ) : status !== 'belum' && pushWords ? (
                pushWords.text
              ) : undefined
            }
            action={
              status === 'belum' ? (
                <Button
                  variant="paper"
                  size="sm"
                  onClick={() => void openPushPrompt()}
                >
                  {copy.nyalakan}
                </Button>
              ) : undefined
            }
          />
          {installWay !== 'terpasang' ? (
            <Step
              icon={<IconPasang size={20} />}
              title={copy.pasang}
              sub={copy.pasangIsi}
              done={false}
              action={
                <Button variant="paper" size="sm" onClick={openInstallSheet}>
                  {copy.pasangTombol}
                </Button>
              }
            />
          ) : null}
        </RuledList>
      </Card>
      <div className="grid gap-2">
        <Button variant="gold" onClick={() => leave('selesai')}>
          {copy.keBeranda}
        </Button>
        <Button variant="ghost" onClick={() => leave('lewati')}>
          {copy.lewati}
        </Button>
      </div>
    </PageBody>
  );
}
