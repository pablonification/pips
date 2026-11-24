// The icons that places driven by data show by key: the service list (Layanan, Beranda's tiles) and global search.
// Only these, because whatever this map holds rides in the chunk every page loads; the whole set by key
// (registry.ts) is for the gallery. tests/icons-by-key.test.ts keeps each key's icon the registry's.
import { IconFolder } from './folder';
import { IconTesti } from './testi';
import { IconNim } from './nim';
import { IconCurhat } from './curhat';
import { IconForm } from './form';
import { IconLomba } from './lomba';
import { IconBeasiswa } from './beasiswa';
import { IconLowongan } from './lowongan';
import { IconKas } from './kas';
import { IconSurat } from './surat';
import { IconGrafik } from './grafik';
import { IconKelola } from './kelola';
import { IconKalender } from './kalender';
import { IconPengumuman } from './pengumuman';
import { IconMatkul } from './matkul';
import { IconLonceng } from './lonceng';
import { IconTerang } from './terang';
import { IconGelap } from './gelap';
import { IconProfil } from './profil';
import { IconPendek } from './pendek';
import { IconAmbil } from './ambil';

export const ICONS_BY_KEY = {
  folder: IconFolder,
  testi: IconTesti,
  nim: IconNim,
  curhat: IconCurhat,
  form: IconForm,
  lomba: IconLomba,
  beasiswa: IconBeasiswa,
  lowongan: IconLowongan,
  kas: IconKas,
  surat: IconSurat,
  grafik: IconGrafik,
  kelola: IconKelola,
  kalender: IconKalender,
  pengumuman: IconPengumuman,
  matkul: IconMatkul,
  lonceng: IconLonceng,
  terang: IconTerang,
  gelap: IconGelap,
  profil: IconProfil,
  pendek: IconPendek,
  ambil: IconAmbil,
};

export type IconByKey = keyof typeof ICONS_BY_KEY;
