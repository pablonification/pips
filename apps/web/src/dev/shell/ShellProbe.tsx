/**
 * The shell's test page (/dev/shell, development and staging only): a drill-down page below Layanan that uses the
 * slots of src/components/shell/page.tsx the way later screens will (P1-B's post detail: its own title under a top
 * bar that names the section). `?judul=…` gives it a title from "data" with usePageTitle(); `?lambat=1` shows its
 * own title 400 ms late, as a screen does while its data loads. Its last button opens the push prompt, as Beranda's
 * row and search do.
 */
import { useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button, Field, IconButton, Textarea } from '~/components/garis';
import { IconBagikan } from '~/components/icons/bagikan';
import { openPushPrompt } from '~/components/push';
import {
  PageBody,
  PageTitle,
  TopBarActions,
  usePageTitle,
} from '~/components/shell/page';

export default function ShellProbe() {
  const { judul, lambat } = useSearch({ strict: false }) as {
    judul?: string;
    lambat?: number;
  };
  usePageTitle(judul);
  const [titled, setTitled] = useState(!lambat);
  useEffect(() => {
    if (!lambat) return;
    const t = setTimeout(() => setTitled(true), 400);
    return () => clearTimeout(t);
  }, [lambat]);
  return (
    <PageBody>
      <TopBarActions>
        <IconButton label="Bagikan halaman uji">
          <IconBagikan />
        </IconButton>
      </TopBarActions>
      {titled ? <PageTitle>Halaman uji shell</PageTitle> : null}
      <Field label="Catatan uji">
        <Textarea rows={3} />
      </Field>
      {Array.from({ length: 30 }, (_, i) => (
        <Button key={i} type="button">
          {`Tombol uji ${i + 1}`}
        </Button>
      ))}
      {/* P1-C: opens the push prompt the way Beranda and search do (P1-A), for the prompt's journeys. */}
      <Button type="button" onClick={() => void openPushPrompt()}>
        Buka prompt notifikasi
      </Button>
    </PageBody>
  );
}
