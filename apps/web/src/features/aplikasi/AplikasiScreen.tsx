import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as api from '~/api/generated/operations';
import type { ConnectedApp } from '~/api/generated';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Item,
  RuledList,
  Skeleton,
  SkeletonRow,
  Tile,
  toast,
} from '~/components/garis';
import { DeskHead, PageBody } from '~/components/shell/page';
import { aplikasi as copy } from '~/copy/aplikasi';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { useDelayed } from '~/hooks/useDelayed';
import { CONNECTED_APPS_QUERY_KEY, connectedAppsQuery } from './data';
import { appName } from './name';
import { AppMark } from './AppMark';
import { appLine, mcpAddress } from './rules';

/**
 * Profil › Aplikasi terhubung: the apps the member connected through MCP, when each was connected and last used,
 * and Putuskan (with a confirmation) to revoke one. Empty: how to connect one.
 */
export function AplikasiScreen() {
  const qc = useQueryClient();
  const apps = useQuery(connectedAppsQuery());
  // The app being asked about stays set while the dialog closes, so its words don't change mid-animation.
  const [asking, setAsking] = useState<ConnectedApp | null>(null);
  const [open, setOpen] = useState(false);
  const showSkeleton = useDelayed(apps.isPending);
  const revoke = useMutation({
    mutationFn: (app: ConnectedApp) =>
      api.revokeConnectedApp({ clientId: app.clientId }),
    onSuccess: (_r, app) => {
      setOpen(false);
      toast.success(fill(copy.diputus, { nama: appName(app.name) }));
      qc.setQueryData<{ apps: ConnectedApp[] }>(
        [CONNECTED_APPS_QUERY_KEY],
        (d) => d && { apps: d.apps.filter((a) => a.clientId !== app.clientId) },
      );
      void qc.invalidateQueries({ queryKey: [CONNECTED_APPS_QUERY_KEY] });
    },
    onError: (_e, app) => {
      setOpen(false);
      toast.error(fill(copy.putusGagal, { nama: appName(app.name) }));
    },
  });

  return (
    <>
      <DeskHead title={common.shell.aplikasiTerhubung} />
      <PageBody className="gap-[18px]">
        {apps.isError ? (
          <ErrorState
            title={copy.gagalMuatDaftar}
            onRetry={() => void apps.refetch()}
            retrying={apps.isFetching}
          />
        ) : apps.isPending ? (
          showSkeleton ? (
            <Skeleton>
              {[0, 1].map((i) => (
                <SkeletonRow key={i} lines={['35%', '60%']} />
              ))}
            </Skeleton>
          ) : null
        ) : apps.data.length === 0 ? (
          <EmptyState
            title={copy.kosong}
            text={
              <>
                {copy.kosongIsi}
                <span className="block strong break-words text-fg">
                  {mcpAddress(
                    import.meta.env.VITE_API_URL,
                    window.location.origin,
                  )}
                </span>
              </>
            }
          />
        ) : (
          <RuledList>
            {apps.data.map((app) => (
              <li key={app.clientId}>
                <Item center className="flex-wrap">
                  <Tile>
                    <AppMark returnHost={app.returnHost} />
                  </Tile>
                  <span className="min-w-0 flex-1">
                    <span className="block t-sub break-words">
                      {appName(app.name)}
                    </span>
                    <span className="block t-cap text-fg-2">
                      {appLine(app)}
                    </span>
                  </span>
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    aria-label={fill(copy.putuskanLabel, {
                      nama: appName(app.name),
                    })}
                    onClick={() => {
                      setAsking(app);
                      setOpen(true);
                    }}
                  >
                    {copy.putuskan}
                  </Button>
                </Item>
              </li>
            ))}
          </RuledList>
        )}
      </PageBody>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          if (!revoke.isPending) setOpen(o);
        }}
        title={fill(copy.putuskanJudul, { nama: appName(asking?.name ?? '') })}
        cancelLabel={copy.batal}
        confirmLabel={revoke.isPending ? copy.memutuskan : copy.putuskan}
        danger
        busy={revoke.isPending}
        onConfirm={() => {
          if (asking && !revoke.isPending) revoke.mutate(asking);
        }}
      >
        {fill(copy.putuskanIsi, { nama: appName(asking?.name ?? '') })}
      </ConfirmDialog>
    </>
  );
}
