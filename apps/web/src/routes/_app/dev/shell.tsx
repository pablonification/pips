import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

const probeSearchSchema = z.object({
  judul: z.string().optional().catch(undefined),
});

/**
 * A page inside the shell that uses every slot a screen has (P0-C round 2): its own title, a title from data, top-bar
 * actions, a field and a long page. The shell's journeys run on it until real screens use the slots. Development and
 * staging only, like the gallery: in a production build the import below is dropped and the path sends members home.
 */
export const Route = createFileRoute('/_app/dev/shell')({
  validateSearch: (search) => probeSearchSchema.parse(search),
  beforeLoad: () => {
    if (!__GARIS_GALLERY__) throw redirect({ to: '/' });
  },
  component: __GARIS_GALLERY__
    ? lazyRouteComponent(() => import('~/dev/shell/ShellProbe'))
    : () => null,
});
