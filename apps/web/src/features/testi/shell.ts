/**
 * Testi Matkul's rules for the shell (P2-B): its levels are titled from the URL as the prototype's `testiTitle`
 * ("Teknik Informatika", "IF · Semester 3", "Mata Kuliah Umum"), and Mata Kuliah Umum's electives sit right below
 * Testi Matkul (they have no semester step), so back and the breadcrumbs never pass a page that only redirects. The
 * course page sets its code with usePageTitle. Registered at start (src/main.tsx); the shell imports no feature code.
 */
import { registerRouteRules } from '~/lib/shell/routes';
import { listOfSlug, majorOfSlug, testiTitle } from './titles';

registerRouteRules({
  '/layanan/testi/$type': {
    title: (p) => testiTitle({ major: majorOfSlug(p.type ?? '') }),
  },
  '/layanan/testi/$type/$semester': {
    title: (p) =>
      testiTitle({
        major: majorOfSlug(p.type ?? ''),
        list: listOfSlug(p.semester ?? ''),
      }),
    parent: (p) =>
      majorOfSlug(p.type ?? '') === 'OTHER'
        ? '/layanan/testi'
        : '/layanan/testi/$type',
  },
});
