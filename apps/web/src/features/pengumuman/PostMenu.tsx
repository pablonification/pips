/**
 * The post's menu (`menuList`, `menuBtn`): mark read or unread for everyone, Umumkan ulang for the author, Hapus
 * for the author or admin. Every item renders through the capability map (`menuModel` uses `canDeleteContent`).
 */
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { Info } from '~/api/generated';
import {
  ConfirmDialog,
  IconButton,
  Menu,
  MenuItem,
  toast,
} from '~/components/garis';
import { IconBaca } from '~/components/icons/baca';
import { IconCentang2 } from '~/components/icons/centang2';
import { IconHapus } from '~/components/icons/hapus';
import { IconLainnya } from '~/components/icons/lainnya';
import { IconUlang } from '~/components/icons/ulang';
import { fill } from '~/copy/fill';
import { pengumuman as t } from '~/copy/pengumuman';
import useSession from '~/hooks/auth/useSession';
import { hm } from '~/lib/dates';
import { useDeleteInfo, useMarkRead, useRenotify, statusOf } from './data';
import {
  audienceWords,
  canRenotify,
  menuLabel,
  menuModel,
  renotifyAvailableAt,
  renotifyFailure,
  renotifyHint,
  type FeedView,
} from './rules';
import { useNow } from './useNow';
import { focusSoon } from './view';

export function PostMenu({
  info,
  /** Where to go after the post is deleted (a post's own page); the feed stays where it is. */
  leaveTo,
  size = 'sm',
}: {
  info: Info;
  leaveTo?: { search?: FeedView };
  size?: 'sm' | 'md';
}) {
  const me = useSession();
  const now = useNow();
  const model = menuModel(info, me);
  const mark = useMarkRead();
  const renotify = useRenotify();
  const del = useDeleteInfo();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const open = canRenotify(info, now);

  const failed = (e: unknown) =>
    toast.error(statusOf(e) === 403 ? t.menu.ditolak : t.menu.gagal);

  return (
    <>
      <Menu
        trigger={
          <IconButton label={menuLabel(info)} size={size}>
            <IconLainnya size={20} />
          </IconButton>
        }
      >
        <MenuItem
          icon={
            model.mark === 'unread' ? (
              <IconBaca size={20} />
            ) : (
              <IconCentang2 size={20} />
            )
          }
          onSelect={() =>
            mark.mutate(
              { id: info.id, read: model.mark === 'read' },
              {
                onSuccess: () =>
                  toast.success(
                    model.mark === 'read'
                      ? t.menu.ditandaiDibaca
                      : t.menu.ditandaiBelumDibaca,
                  ),
                onError: failed,
              },
            )
          }
        >
          {model.mark === 'read'
            ? t.menu.tandaiDibaca
            : t.menu.tandaiBelumDibaca}
        </MenuItem>
        {model.renotify ? (
          <MenuItem
            icon={<IconUlang size={20} />}
            disabled={!open}
            hint={open ? t.menu.umumkanUlangHint : renotifyHint(info)}
            onSelect={() => {
              if (!open) {
                toast.success(
                  fill(t.menu.terkunci, {
                    jam: hm(renotifyAvailableAt(info.lastNotifiedAt)),
                  }),
                );
                return;
              }
              renotify.mutate(info.id, {
                onSuccess: () =>
                  toast.success(
                    fill(t.menu.diumumkanUlang, {
                      sasaran: audienceWords(info),
                    }),
                  ),
                onError: (e) => {
                  const kind = renotifyFailure(statusOf(e));
                  if (kind === 'locked')
                    toast.success(
                      fill(t.menu.terkunci, {
                        jam: hm(renotifyAvailableAt(info.lastNotifiedAt)),
                      }),
                    );
                  else failed(e);
                },
              });
            }}
          >
            {t.menu.umumkanUlang}
          </MenuItem>
        ) : null}
        {model.remove ? (
          <MenuItem
            danger
            icon={<IconHapus size={20} />}
            hint={model.remove === 'admin' ? t.menu.sebagaiAdmin : undefined}
            onSelect={() => setConfirm(true)}
          >
            {t.menu.hapus}
          </MenuItem>
        ) : null}
      </Menu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t.hapus.postJudul}
        confirmLabel={t.hapus.ya}
        cancelLabel={t.hapus.batal}
        danger
        onConfirm={() =>
          del.mutate(info.id, {
            onSuccess: () => {
              setConfirm(false);
              toast.success(t.hapus.postDihapus);
              if (leaveTo) {
                void navigate({
                  to: '/pengumuman',
                  search: leaveTo.search ?? {},
                  replace: true,
                });
              }
              focusSoon(() =>
                document.querySelector<HTMLElement>('[data-page-title]'),
              );
            },
            onError: (e) => {
              setConfirm(false);
              failed(e);
            },
          })
        }
      >
        {t.hapus.postText}
      </ConfirmDialog>
    </>
  );
}
