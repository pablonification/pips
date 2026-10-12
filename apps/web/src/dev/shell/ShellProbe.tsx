/**
 * The shell's test page (/dev/shell, development and staging only): a drill-down page below Layanan that uses the
 * slots of src/components/shell/page.tsx the way later screens will (P1-B's post detail: its own title under a top
 * bar that names the section). `?judul=…` gives it a title from "data" with usePageTitle().
 */
import { useSearch } from '@tanstack/react-router';
import { Button, Field, IconButton, Textarea } from '~/components/garis';
import { IconBagikan } from '~/components/icons/bagikan';
import {
  PageBody,
  PageTitle,
  TopBarActions,
  usePageTitle,
} from '~/components/shell/page';

export default function ShellProbe() {
  const { judul } = useSearch({ strict: false }) as { judul?: string };
  usePageTitle(judul);
  return (
    <PageBody>
      <TopBarActions>
        <IconButton label="Bagikan halaman uji">
          <IconBagikan />
        </IconButton>
      </TopBarActions>
      <PageTitle>Halaman uji shell</PageTitle>
      <Field label="Catatan uji">
        <Textarea rows={3} />
      </Field>
      {Array.from({ length: 30 }, (_, i) => (
        <Button key={i} type="button">
          {`Tombol uji ${i + 1}`}
        </Button>
      ))}
    </PageBody>
  );
}
