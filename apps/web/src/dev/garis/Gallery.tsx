/**
 * The Garis gallery (/dev/garis, development and staging only): the prototype's design-system page
 * (hmif-garis-sistem.html, garis/system.js) rebuilt from the real components, then every token and the components
 * the page doesn't show. The fidelity tool compares `#sys` and `#kit` with the locked `system-cards` and
 * `system-kit` captures.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { IconCentang } from '~/components/icons/centang';
import { IconFolder, GlyphFolder } from '~/components/icons/folder';
import { IconHapus } from '~/components/icons/hapus';
import { IconKalender } from '~/components/icons/kalender';
import { IconKunci } from '~/components/icons/kunci';
import { IconLainnya } from '~/components/icons/lainnya';
import { IconPengumuman } from '~/components/icons/pengumuman';
import {
  ICON_KEYS,
  ICON_LABELS,
  ICONS,
  GLYPH_KEYS,
  GLYPHS,
} from '~/components/icons/registry';
import { IconSistem } from '~/components/icons/sistem';
import { IconTambah } from '~/components/icons/tambah';
import { IconTerang } from '~/components/icons/terang';
import { IconGelap } from '~/components/icons/gelap';
import { IconUlang } from '~/components/icons/ulang';
import { IconUrut } from '~/components/icons/urut';
import {
  Avatar,
  AvatarButton,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  Chips,
  Due,
  FactsList,
  Kbd,
  Rating,
  ReactionButton,
  Reactions,
  ReactionStack,
  SksMark,
  UnreadBar,
  ConfirmDialog,
  Count,
  Dialog,
  Disclosure,
  EmptyState,
  ErrorState,
  Field,
  Halftone,
  HmifLogo,
  IconButton,
  Input,
  Item,
  LinkButton,
  Media,
  Menu,
  MenuItem,
  Modal,
  NoteBox,
  OfflineBanner,
  Options,
  PIXEL_REACTION_KEYS,
  PIXEL_REACTION_LABELS,
  PixelReaction,
  type PixelReactionKey,
  Plaque,
  Popover,
  Radio,
  RowButton,
  RuledList,
  Saved,
  Searchbox,
  SectionHead,
  Seg,
  Segbar,
  Select,
  Sheet,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
  SkeletonRow,
  StatusTag,
  Switch,
  Tag,
  Textarea,
  Tile,
  Toaster,
  Wordmark,
  toast,
} from '~/components/garis';
import { contrast, formatRatio } from '~/lib/theme/contrast.mjs';
import { useTheme } from '~/lib/theme/useTheme';
import type { ThemePreference } from '~/lib/theme/theme';
import './gallery.css';

const Check = () => (
  <span className="cg">
    <IconCentang size={16} />
  </span>
);

function Rules({ items }: { items: ReactNode[] }) {
  return (
    <ul className="rules">
      {items.map((x, i) => (
        <li key={i}>
          <Check />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

const SCALE: [string, ReactNode, string, string][] = [
  [
    'Display besar',
    <span className="t-display-l">Halo, Nadia</span>,
    'Archivo Expanded 700 · 32 px · 1,1',
    'Judul halaman dan sapaan di desktop',
  ],
  [
    'Display',
    <span className="t-display">Pengumuman</span>,
    'Archivo Expanded 700 · 24 px · 1,15',
    'Judul halaman dan sapaan di ponsel',
  ],
  [
    'Judul',
    <span className="t-title">Jadwal UTS sudah keluar</span>,
    'Geist 600 · 20 px · 1,3',
    'Judul pengumuman, acara, bagian form',
  ],
  [
    'Subjudul',
    <span className="t-heading">Perlu ditindaklanjuti</span>,
    'Geist 600 · 17 px · 1,35',
    'Judul bagian dan dialog',
  ],
  [
    'Isi panjang',
    <span className="t-body-l">UTS berlangsung 19–23 Oktober.</span>,
    'Geist 400 · 16 px · 1,6',
    'Isi pengumuman, isian form',
  ],
  [
    'Isi',
    <span className="t-sub">Ding Dong</span>,
    'Geist 400/600 · 15 px · 1,5',
    'Baris daftar',
  ],
  [
    'Kecil',
    <span className="t-sm">Folder materi mata kuliahmu</span>,
    'Geist 400 · 14 px · 1,5',
    'Keterangan',
  ],
  [
    'Keterangan',
    <span className="t-cap text-fg-3">Raka Pratama · 1 jam lalu</span>,
    'Geist 400/500 · 13 px · 1,4',
    'Info tambahan',
  ],
  [
    'Mikro',
    <Tag>Akademik</Tag>,
    'Geist 500 · 12 px · 1,3',
    'Pil, lencana, sumbu (batas terkecil)',
  ],
  [
    'Angka',
    <span className="t-label num">IF2110 · 13525045 · 15.00–16.40</span>,
    'Geist 500 · 14 px · angka tabular',
    'NIM, kode mata kuliah, jam',
  ],
];

const TRIMS: [string, string][] = [
  [
    'Halo, Nadia',
    'Kamis, 8 Oktober 2026 · 13.35 WIB, lalu “Selamat siang, Nadia”',
  ],
  [
    'Form Analisis Kondisi PIXEL · 5 bagian · Isi',
    'Untuk angkatan 2025 · PIXEL · 5 bagian, ±10 menit · Isi sekarang · Isi',
  ],
  [
    'Balasan baru dari Welfare · Hari ini, 10.12',
    'Welfare membalas di Teal Koala, dengan cuplikan pesannya di Beranda',
  ],
  [
    'Tutup Rab 14 Okt, 23.59',
    'Pendaftaran Sen 21 Sep – Rab 14 Okt · Tutup 6 hari lagi · Ditambahkan oleh divisi Competition and Community',
  ],
];

const VOICE: [string, string][] = [
  ['Umumkan ulang bisa lagi mulai 15.30.', 'Error: cannot renotify'],
  ['Ding Dong dan acara Akademik masih kosong.', 'No data'],
  ['Pertanyaan ini wajib diisi', 'FIELD REQUIRED!'],
];

const NEW: [string, ReactNode][] = [
  [
    'Usulan',
    <>
      <b>Beranda “Perlu ditindaklanjuti”</b> dari sinyal yang sudah ada, yang
      paling mendesak di atas: tenggat besok, balasan Curhat, form untuk
      angkatanmu, mata kuliah belum diatur, notifikasi mati.
    </>,
  ],
  [
    'Perbaikan',
    <>
      <b>Nyalakan notifikasi</b> sebagai langkah yang jelas. Di kode sekarang
      izin notifikasi tidak pernah diminta setelah masuk.
    </>,
  ],
  [
    'Usulan',
    <>
      <b>Kalender jadi tab</b> dan <b>8 hari ke depan</b> di Beranda,
      menggantikan strip 7 hari.
    </>,
  ],
  [
    'Usulan',
    <>
      <b>Pencarian global</b> (kolom cari di Beranda ponsel, Ctrl K di desktop),{' '}
      <b>Pintasan</b> di desktop, dan <b>mode gelap</b>. Bilah tab disembunyikan
      saat mengisi form, menulis pengumuman, atau Curhat.
    </>,
  ],
  [
    'Usulan',
    'Form mengisi nama dan NIM dari akunmu; NIM Finder bisa menyalin NIM; acara akademik menautkan ke Ding Dong dan Testi Matkul.',
  ],
];

/** The live tokens of the theme on screen, as the prototype's measureCards() reads them. */
function useTokenReader() {
  const { theme } = useTheme();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTick((t) => t + 1));
    return () => cancelAnimationFrame(id);
  }, [theme]);
  const tok = (n: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return {
    theme,
    tick,
    ratio: (a: string, b: string) => contrast(tok(a), tok(b)),
  };
}

function Pairs() {
  const { theme, ratio } = useTokenReader();
  const bgs: [string, string][] = [
    ['--bg-app', 'Latar aplikasi'],
    ['--bg-surface', 'Kartu dan isian'],
    ['--bg-muted', 'Isian redup'],
  ];
  const texts: [string, string, boolean][] = [
    ['--text', 'Teks utama', true],
    ['--text-2', 'Teks kedua', false],
    ['--text-3', 'Teks ketiga', false],
    ['--text-accent', 'Aksen', false],
    ['--text-danger', 'Peringatan', false],
  ];
  return (
    <div id="pairs">
      <p className="t-cap text-fg-3">
        Diukur langsung dari token mode {theme === 'dark' ? 'gelap' : 'terang'}.
        Batas WCAG untuk teks: 4,5:1.
      </p>
      <div className="pair-grid">
        {bgs.map(([bg, name]) => (
          <div key={bg} className="pair" style={{ background: `var(${bg})` }}>
            <span className="t-micro text-fg-3">{name}</span>
            {texts.map(([t, l, bold]) => {
              const body = (
                <>
                  {l} <span className="num">{formatRatio(ratio(t, bg))}</span>
                </>
              );
              return bold ? (
                <b key={t} style={{ color: `var(${t})` }}>
                  {body}
                </b>
              ) : (
                <span key={t} style={{ color: `var(${t})` }}>
                  {body}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Layers() {
  const { ratio } = useTokenReader();
  const row = (
    bg: string,
    name: string,
    note: ReactNode,
    value: ReactNode,
    style: CSSProperties = {},
  ) => (
    <div className="layer" style={{ background: `var(${bg})`, ...style }}>
      <span>
        <b>{name}</b>
        <br />
        <span className="t-cap" style={{ opacity: 0.85 }}>
          {note}
        </span>
      </span>
      <span className="t-label num">{value}</span>
    </div>
  );
  return (
    <div className="layers" id="layers">
      {row(
        '--bg-app',
        'Latar aplikasi',
        'Hampir putih atau hampir hitam, dengan sedikit hangat; tidak pernah putih atau hitam murni',
        'dasar',
        { boxShadow: 'inset 0 0 0 1px var(--border)' },
      )}
      {row(
        '--bg-surface',
        'Kartu, isian, dan sidebar',
        `Dipisah garis 1 px (${formatRatio(ratio('--border', '--bg-surface'))})`,
        `${formatRatio(ratio('--bg-surface', '--bg-app'))} dari latar`,
        { boxShadow: '0 0 0 1px var(--border)' },
      )}
      {row(
        '--bg-muted',
        'Isian redup',
        'Ubin ikon, label, jalur saklar',
        `${formatRatio(ratio('--bg-muted', '--bg-app'))} dari latar`,
      )}
      {row(
        '--bg-inverse',
        'Kebalikan',
        'Blok kecil seperti SKS; tinta di mode terang, krem di mode gelap',
        `${formatRatio(ratio('--bg-inverse', '--bg-app'))} dari latar`,
        { color: 'var(--text-on-inverse)' },
      )}
      <div
        className="layer"
        style={{
          background: 'var(--gold)',
          color: 'var(--ink)',
          boxShadow: '0 0 0 1.5px var(--ink)',
        }}
      >
        <span>
          <b>Plakat emas</b>
          <br />
          <span className="t-cap">
            Satu hal terpenting per layar, selalu berbingkai tinta
          </span>
        </span>
        <span className="t-label num">
          tinta di emas {formatRatio(ratio('--ink', '--gold'))}
        </span>
      </div>
    </div>
  );
}

/** A token's value as the page shows it (#F8C249), read from the stylesheet so the page holds no colour itself. */
function useTokenValue(token: string) {
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(
      getComputedStyle(
        document.querySelector('.gal') ?? document.documentElement,
      )
        .getPropertyValue(token)
        .trim()
        .toUpperCase(),
    );
  }, [token]);
  return value;
}

function Swatch({
  name,
  token,
  role,
}: {
  name: string;
  token: string;
  role: string;
}) {
  const hex = useTokenValue(token);
  return (
    <div className="sw">
      <div className="chip-c" style={{ background: `var(${token})` }} />
      <div className="meta">
        <b>{name}</b>
        <br />
        <span className="text-fg-3 code">{hex}</span>
        <br />
        <span className="text-fg-2">{role}</span>
      </div>
    </div>
  );
}

/** The design-system cards (prototype `#sys`): type, content, colour, layers, icons, pills, marks, motion, voice. */
function SystemCards() {
  const hmifBronze = useTokenValue('--px-bronze');
  return (
    <div className="sys-grid" id="sys" data-testid="garis-sys">
      <div className="sys-card wide">
        <h3 className="t-heading">Skala huruf: sembilan ukuran, dua huruf</h3>
        <table className="scale-table">
          <thead>
            <tr>
              <th scope="col">Peran</th>
              <th scope="col">Contoh</th>
              <th scope="col">Spesifikasi</th>
              <th scope="col">Dipakai untuk</th>
            </tr>
          </thead>
          <tbody>
            {SCALE.map(([r, ex, spec, use]) => (
              <tr key={r}>
                <td className="t-label strong">{r}</td>
                <td>{ex}</td>
                <td className="t-cap text-fg-2">{spec}</td>
                <td>{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Rules
          items={[
            <>
              <b>Huruf biasa (sentence case) di mana pun.</b> Tidak ada label
              kapital, termasuk pil dan label kecil. Huruf kapital hanya ada di
              dalam logo resmi.
            </>,
            <>
              <b>Tanpa mono.</b> NIM, kode mata kuliah, dan jam memakai Geist
              dengan angka tabular, agar sejajar tanpa terlihat seperti kode.
            </>,
            <>
              <b>Archivo lebar hanya untuk judul halaman dan sapaan</b>,
              beberapa kata per layar. Selebihnya Geist.
            </>,
            <>
              <b>Tidak ada teks di bawah 12 px.</b> Warna teks hanya dari empat
              peran: utama, kedua, ketiga, aksen (plus peringatan dan berhasil).
            </>,
          ]}
        />
      </div>
      <div className="sys-card wide">
        <h3 className="t-heading">Isi: antarmukanya yang bicara</h3>
        <Rules
          items={[
            <>
              <b>Teks hanya muncul kalau tampilan belum cukup.</b> Judul, ikon,
              urutan, dan tombol sudah menjelaskan; kalimat tambahan harus
              mencegah kesalahan atau menjawab pertanyaan nyata.
            </>,
            <>
              <b>Tanpa label kecil di atas judul.</b> Judul halaman dan navigasi
              yang aktif sudah memberi tahu kamu sedang di mana.
            </>,
            <>
              <b>Pil dan angka hanya bila menambah sesuatu</b> yang belum
              terlihat di baris itu. Jumlah belum dibaca cukup di navigasi.
            </>,
            <>
              <b>Detail sekunder dilipat</b> di balik label yang menyebut
              isinya, misalnya “Informasi akun”, dan terbuka sendiri kalau
              memang dibutuhkan.
            </>,
          ]}
        />
        <ul className="voice">
          {TRIMS.map(([keep, gone]) => (
            <li key={keep}>
              <Check />
              <span>
                <b style={{ fontWeight: 600 }}>{keep}</b>
                <br />
                <span className="sr-only">Sebelumnya: </span>
                <span className="no">{gone}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Warna teks</h3>
        <Pairs />
        <Rules
          items={[
            'Teks ketiga hanya untuk info tambahan, tidak untuk hal yang harus dibaca.',
            'Aksen perunggu (emas di mode gelap) hanya untuk tautan dan tindakan, bukan dekorasi.',
          ]}
        />
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Latar dan lapisan</h3>
        <Layers />
        <Rules
          items={[
            <>
              <b>Tidak ada putih di atas putih atau hitam di atas hitam</b>{' '}
              tanpa batas: lapisan berbeda kecerahan minimal 1,1:1 atau dipisah
              garis 1 px.
            </>,
            'Sidebar, bilah tab, dan notifikasi mengikuti tema: terang di mode terang, gelap di mode gelap.',
            'Gambar diberi garis tipis 10% agar tidak luruh ke latar.',
          ]}
        />
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Ikonografi</h3>
        <div className="icon-sizes">
          <figure>
            <IconKalender size={16} />
            <figcaption>
              16 px
              <br />
              di samping teks kecil
            </figcaption>
          </figure>
          <figure>
            <IconKalender size={20} />
            <figcaption>
              20 px
              <br />
              bawaan
            </figcaption>
          </figure>
          <figure>
            <IconKalender size={24} />
            <figcaption>
              24 px
              <br />
              bilah tab
            </figcaption>
          </figure>
          <figure>
            <Tile>
              <IconKalender size={20} />
            </Tile>
            <figcaption>
              Ubin 36 px
              <br />
              untuk daftar
            </figcaption>
          </figure>
          <figure>
            <span className="g-btn gold sm" aria-hidden="true">
              <IconTambah size={16} />
              Buat
            </span>
            <figcaption>
              Dalam tombol
              <br />
              garis 2 px
            </figcaption>
          </figure>
          <figure>
            <span className="gal-tile-btn" aria-hidden="true">
              <span className="key">
                <GlyphFolder />
              </span>
            </span>
            <figcaption>
              Ubin layanan
              <br />
              dua warna
            </figcaption>
          </figure>
        </div>
        <Rules
          items={[
            'Tiga ukuran saja. Garis selalu tampil 1,5 px, dan 2 px di dalam tombol tebal serta tab aktif.',
            'Kisi 24 px, ujung dan sudut siku, dibangun dari persegi dan garis datar; titiknya persegi seperti piksel.',
            'Warna mengikuti teks. Ubin emas hanya untuk hal yang perlu tindakan darimu sekarang.',
            'Ubin layanan di Beranda memakai ikon yang sama dalam dua warna: garis tinta di atas isian emas.',
          ]}
        />
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Pil, chip, dan lencana</h3>
        <div className="wrap" style={{ gap: 8 }}>
          <Tag>Akademik</Tag>
          <Tag>Kelas 02</Tag>
          <StatusTag status="open" />
          <StatusTag status="soon" />
          <StatusTag status="done" />
          <Tag tone="inverse">Pengurus</Tag>
        </div>
        <div className="wrap" style={{ gap: 8 }}>
          <Chip selected={false} icon={<IconUrut size={16} />}>
            {' '}
            Terbaru
          </Chip>
          <Chip selected count={4}>
            Belum dibaca{' '}
          </Chip>
          <Count value={3} />
        </div>
        <Rules
          items={[
            <>
              <b>Label (tag)</b> untuk keterangan diam: Geist 12 px, huruf
              biasa, latar redup.
            </>,
            <>
              <b>Status</b> selalu ikon + kata + warna, jadi tetap terbaca tanpa
              warna.
            </>,
            <>
              <b>Chip</b> untuk filter yang bisa ditekan: bergaris; yang
              terpilih jadi blok gelap (emas di mode gelap).
            </>,
          ]}
        />
      </div>
      <div className="sys-card">
        <h3 className="t-heading">
          Reaksi piksel: sisi “game” yang dipertahankan
        </h3>
        <div className="px-show">
          {PIXEL_REACTION_KEYS.map((k) => (
            <figure key={k}>
              <PixelReaction reaction={k} size={40} />
              <figcaption>{PIXEL_REACTION_LABELS[k]}</figcaption>
            </figure>
          ))}
        </div>
        <p className="t-sm text-fg-2">
          Enam reaksi PIPS! digambar di kisi 10 × 10 seperti bit. Bersama tombol
          emas yang turun seperti tuts dan kartu anggota berplakat emas, inilah
          rasa “game” yang dijaga. Bingkai pikselnya berubah perunggu di mode
          gelap agar tetap terlihat.
        </p>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Logo HMIF</h3>
        <div className="logo-show">
          <HmifLogo width={800} alt="Logo resmi HMIF ITB" />
        </div>
        <Rules
          items={[
            'Selalu dari berkas resminya dan utuh: tidak digambar ulang, dipotong, diwarnai ulang, diregangkan, diberi garis tambahan, atau ditutupi kartu.',
            'Tampil di sidebar desktop, kartu anggota, ikon aplikasi, dan layar pembuka, minimal selebar 40 px seperti di aplikasi sekarang.',
            'Taruh di atas latar yang kontras dengan emasnya, seperti tinta atau kertas. Di atas emas, beri alas tinta agar tepinya tetap terlihat, seperti di kartu anggota.',
            'Unsur aplikasi sendiri (halftone, reaksi piksel, tombol emas, ikon) tidak meniru bagian logo.',
          ]}
        />
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Palet merek</h3>
        <div className="swatches">
          <Swatch
            name="Emas"
            token="--gold"
            role="Kepala Beranda, plakat, tombol utama, tab aktif"
          />
          <Swatch name="Tinta" token="--ink" role="Teks, bingkai, batang" />
          <Swatch name="Krem" token="--cream" role="Teks di atas tinta" />
          <Swatch
            name="Perunggu"
            token="--gal-bronze"
            role="Tautan di mode terang"
          />
        </div>
        <p className="t-sm text-fg-2">
          Diambil dari logo dan hmif.dev. Perunggu asli HMIF (
          <span className="code">{hmifBronze}</span>) hanya 4,4:1 di atas
          kertas, jadi teks kecil memakai perunggu gelap.
        </p>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Nama aplikasi, ikon, dan layar pembuka</h3>
        <div className="app-icons">
          <figure>
            <span className="appicon">
              <HmifLogo width={54} />
            </span>
            <figcaption>Ikon aplikasi</figcaption>
          </figure>
          <figure>
            <span
              className="splash"
              role="img"
              aria-label="Layar pembuka PIPS!"
            >
              <HmifLogo width={60} />
              <Wordmark size={15} />
            </span>
            <figcaption>Layar pembuka</figcaption>
          </figure>
        </div>
        <p className="t-sm text-fg-2">
          Nama aplikasinya tetap <b style={{ color: 'var(--text)' }}>PIPS!</b>,
          seperti yang sudah terpasang di HP anggota sejak 2024. Layar masuk
          tetap menyapa “Halo, Pips!”. Ikon dan layar pembuka menaruh logo resmi
          di tengah dengan ruang kosong di sekelilingnya, seperti ikon PIPS!
          sekarang; hanya latar hijaunya yang diganti tinta.
        </p>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Gerak</h3>
        <ul className="g-ruled-list motion-list">
          <li>
            <span>Batang di strip “8 hari” tergambar dari kiri</span>
            <span className="text-fg-3">520 ms</span>
          </li>
          <li>
            <span>Tombol ditekan mengecil ke 0,96; tombol emas turun 2 px</span>
            <span className="text-fg-3">100 ms</span>
          </li>
          <li>
            <span>Pindah halaman: isi naik 6 px</span>
            <span className="text-fg-3">220 ms</span>
          </li>
          <li>
            <span>Lembar bawah di ponsel naik</span>
            <span className="text-fg-3">220 ms</span>
          </li>
          <li>
            <span>Penanda “live” berkedip 4× lalu diam</span>
            <span className="text-fg-3">4 s</span>
          </li>
        </ul>
        <p className="t-cap text-fg-3">
          Semua gerak mati bila perangkat meminta gerak dikurangi.
        </p>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Bahasa</h3>
        <ul className="voice">
          {VOICE.map(([good, bad]) => (
            <li key={good}>
              <Check />
              <span>
                <b style={{ fontWeight: 600 }}>{good}</b>
                <br />
                <span className="sr-only">Hindari: </span>
                <span className="no">{bad}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="t-cap text-fg-3">
          Kata-kata jelas, pendek, dan memakai “kamu”. Nama layanan yang sudah
          dikenal anggota tidak diganti.
        </p>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Yang baru dibanding PIPS! sekarang</h3>
        <ul className="g-ruled-list new-list">
          {NEW.map(([k, v], i) => (
            <li key={i}>
              <Tag tone={k === 'Perbaikan' ? 'success' : 'accent'}>{k}</Tag>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One kit panel (prototype `#kit`), forced to a theme with .theme-light / .theme-dark. */
function KitPanel({
  theme,
  label,
}: {
  theme: 'light' | 'dark';
  label: string;
}) {
  const [chip, setChip] = useState(true);
  const [chip2, setChip2] = useState(false);
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [nim, setNim] = useState('13525045');
  const [body, setBody] = useState('');
  const [interest, setInterest] = useState(true);
  const [game, setGame] = useState(true);
  return (
    <div
      className={`kit-panel theme-${theme}`}
      data-testid={`garis-kit-${theme}`}
    >
      <h3 className="t-heading">{label}</h3>
      <div className="wrap">
        <Button variant="gold">
          <IconPengumuman size={16} />
          Umumkan
        </Button>
        <Button variant="paper">Batal</Button>
        <Button variant="ghost">Lihat semua</Button>
        <Button variant="danger">Hapus</Button>
      </div>
      <div className="wrap" style={{ gap: 8 }}>
        <Tag>Akademik</Tag>
        <StatusTag status="open" />
        <StatusTag status="soon" />
        <StatusTag status="done" />
        <Tag tone="inverse">Pengurus</Tag>
      </div>
      <div className="wrap" style={{ gap: 8 }}>
        <Chip selected={chip} onSelectedChange={setChip} count={4}>
          Belum dibaca{' '}
        </Chip>
        <Chip selected={chip2} onSelectedChange={setChip2}>
          Terbaru
        </Chip>
        <Switch
          checked={on}
          onCheckedChange={setOn}
          aria-label="Contoh switch menyala"
        />
        <Switch
          checked={off}
          onCheckedChange={setOff}
          aria-label="Contoh switch mati"
        />
      </div>
      <div className="kit-fields">
        <Field label="NIM" hint="8 angka, misalnya 13525045">
          <Input
            className="num"
            value={nim}
            onChange={(e) => setNim(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </Field>
        <Field label="Isi pengumuman" error="Isi pengumuman belum ditulis.">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
      <Options>
        <Radio
          name={`k-r-${theme}`}
          checked={interest}
          onChange={() => setInterest(true)}
        >
          Tertarik
        </Radio>
        <Checkbox checked={game} onChange={(e) => setGame(e.target.checked)}>
          Main game
        </Checkbox>
      </Options>
      <Card
        style={{
          padding: '14px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <SksMark sks={3} />
        <span className="min-w-0 flex-1">
          <span className="block t-label num">IF2110</span>
          <span className="block t-sm">Algoritma dan Pemrograman II</span>
        </span>
        <Tag tone="outlined">Kelas 02</Tag>
      </Card>
      <Skeleton label="Memuat pengumuman">
        <SkeletonRow />
      </Skeleton>
      <Disclosure label="Informasi akun">
        <p className="t-sm text-fg-2">
          Detail sekunder terlipat; labelnya menyebut isinya.
        </p>
      </Disclosure>
      <EmptyState
        title="Belum ada form untukmu"
        text="Form muncul di sini kalau HMIF membuka form untuk angkatanmu."
      />
    </div>
  );
}

const SEMANTIC_TOKENS: [string, string[]][] = [
  [
    'Latar',
    [
      '--bg-page',
      '--bg-app',
      '--bg-chrome',
      '--bg-surface',
      '--bg-raised',
      '--bg-muted',
      '--bg-hover',
      '--bg-accent',
      '--bg-accent-subtle',
      '--bg-inverse',
      '--bg-selected',
      '--bg-event',
      '--bg-hero',
    ],
  ],
  [
    'Teks',
    [
      '--text',
      '--text-2',
      '--text-3',
      '--text-accent',
      '--text-danger',
      '--text-success',
      '--text-on-accent',
      '--text-on-inverse',
      '--text-on-selected',
      '--text-on-event',
      '--text-on-hero',
    ],
  ],
  [
    'Garis',
    [
      '--border',
      '--border-strong',
      '--border-key',
      '--focus',
      '--mark',
      '--danger-solid',
      '--danger-edge',
      '--px-rim',
      '--glyph-fill',
      '--hero-tone',
    ],
  ],
  ['Merek', ['--gold', '--gold-hover', '--ink', '--cream']],
];

function TokenPanel({ theme }: { theme: 'light' | 'dark' }) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-testid="garis-tokens-${theme}"]`,
    );
    if (!el) return;
    const cs = getComputedStyle(el);
    setValues(
      Object.fromEntries(
        SEMANTIC_TOKENS.flatMap(([, list]) => list).map((t) => [
          t,
          cs.getPropertyValue(t).trim(),
        ]),
      ),
    );
  }, [theme]);
  return (
    <div
      className={`kit-panel theme-${theme}`}
      data-testid={`garis-tokens-${theme}`}
    >
      <h3 className="t-heading">
        {theme === 'light' ? 'Token di mode terang' : 'Token di mode gelap'}
      </h3>
      {SEMANTIC_TOKENS.map(([group, list]) => (
        <div key={group} className="grid gap-2">
          <h4 className="t-label">{group}</h4>
          <div className="tok-grid">
            {list.map((t) => (
              <div key={t} className="tok">
                <span className="chip-c" style={{ background: `var(${t})` }} />
                <span>
                  <span className="block t-label">{t}</span>
                  <span className="t-cap text-fg-3 code">
                    {values[t] ?? ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Three of the prototype's announcement categories (data.js CATEGORIES), for the checkbox chips. */
/** Sample counts for the reaction row, without the member's own. */
const SAMPLE_REACTIONS = { grin: 12, fire: 7, party: 3 } as const;

const CATEGORY_NAMES = {
  akademik: 'Akademik',
  himpunan: 'Himpunan',
  lomba: 'Lomba',
} as const;

/** Overlays, menus, toasts and states, to try by hand and in the gallery journey. */
function Interactive() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [seg, setSeg] = useState<'semua' | 'akademik' | 'himpunan'>('semua');
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('IF2110');
  const [notes, setNotes] = useState('');
  const [retries, setRetries] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [menuResult, setMenuResult] = useState('');
  const [deletePost, setDeletePost] = useState(false);
  const [cats, setCats] = useState<string[]>(['akademik']);
  const [kelas, setKelas] = useState<number | null>(null);
  const [myReaction, setMyReaction] = useState<PixelReactionKey | null>('fire');
  const [rating, setRating] = useState<number | null>(null);
  return (
    <div className="sys-grid" data-testid="garis-interactive">
      <div className="sys-card">
        <h3 className="t-heading">Dialog, lembar, dan konfirmasi</h3>
        <div className="demo-row">
          <Button variant="paper" onClick={() => setDialog(true)}>
            Buka dialog
          </Button>
          <Button variant="paper" onClick={() => setSheet(true)}>
            Buka lembar
          </Button>
          <Button variant="paper" onClick={() => setModal(true)}>
            Buka sesuai layar
          </Button>
          <Button variant="danger-ghost" onClick={() => setConfirm(true)}>
            <IconHapus size={16} />
            Hapus ruang
          </Button>
        </div>
        <Dialog
          open={dialog}
          onOpenChange={setDialog}
          title="Detail acara"
          footer={
            <>
              <Button variant="paper" onClick={() => setDialog(false)}>
                Batal
              </Button>
              <Button variant="gold" onClick={() => setDialog(false)}>
                Simpan
              </Button>
            </>
          }
        >
          <Field label="Judul acara">
            <Input defaultValue="Kuis 2" />
          </Field>
          <Menu
            align="start"
            trigger={
              <Button variant="paper" size="sm">
                <IconLainnya size={16} />
                Pilihan acara
              </Button>
            }
          >
            <MenuItem onSelect={() => setMenuResult('Tautan acara disalin')}>
              Salin tautan acara
            </MenuItem>
          </Menu>
        </Dialog>
        <Sheet open={sheet} onOpenChange={setSheet} title="Filter">
          <Seg
            label="Kategori"
            full
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'semua', label: 'Semua' },
              { value: 'akademik', label: 'Akademik' },
              { value: 'himpunan', label: 'Himpunan' },
            ]}
          />
          <Button variant="gold" wide onClick={() => setSheet(false)}>
            Terapkan
          </Button>
        </Sheet>
        <Modal
          open={modal}
          onOpenChange={setModal}
          title="Nyalakan notifikasi?"
          description="Pengumuman baru, pengingat H-1, dan balasan Curhat akan sampai ke perangkat ini."
        >
          <Button variant="gold" onClick={() => setModal(false)}>
            Nyalakan
          </Button>
        </Modal>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Hapus ruang ini?"
          confirmLabel="Hapus ruang"
          cancelLabel="Batal"
          danger
          onConfirm={() => {
            setConfirm(false);
            toast.success('Ruang dihapus.');
          }}
        >
          Semua pesan di ruang ini ikut terhapus dan tidak bisa dikembalikan.
        </ConfirmDialog>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Popover, menu, dan notifikasi singkat</h3>
        <div className="demo-row">
          <Popover
            label="Pilih reaksi"
            trigger={
              <Button variant="paper">
                <IconLainnya size={16} />
                Reaksi
              </Button>
            }
          >
            <div className="flex gap-1">
              {PIXEL_REACTION_KEYS.map((k) => (
                <IconButton key={k} label={PIXEL_REACTION_LABELS[k]}>
                  <PixelReaction reaction={k} size={24} />
                </IconButton>
              ))}
            </div>
          </Popover>
          <Menu
            trigger={
              <IconButton label="Pilihan lain">
                <IconLainnya size={20} />
              </IconButton>
            }
          >
            <MenuItem
              icon={<IconUlang size={16} />}
              disabled
              hint="Bisa lagi mulai 15.30"
              onSelect={() =>
                toast.success(
                  'Umumkan ulang bisa lagi mulai 15.30. Jeda 3 jam supaya anggota tidak kebanjiran notifikasi.',
                )
              }
            >
              Umumkan ulang
            </MenuItem>
            <MenuItem onSelect={() => setMenuResult('Tautan disalin')}>
              Salin tautan
            </MenuItem>
            <MenuItem
              danger
              icon={<IconHapus size={16} />}
              onSelect={() => setDeletePost(true)}
            >
              Hapus
            </MenuItem>
          </Menu>
          <ConfirmDialog
            open={deletePost}
            onOpenChange={setDeletePost}
            title="Hapus pengumuman ini?"
            confirmLabel="Hapus"
            cancelLabel="Batal"
            danger
            onConfirm={() => {
              setDeletePost(false);
              toast.success('Pengumuman dihapus.');
            }}
          >
            Pengumuman, komentar, dan reaksinya ikut terhapus.
          </ConfirmDialog>
          <span className="t-cap text-fg-2" data-testid="menu-result">
            {menuResult}
          </span>
        </div>
        <div className="demo-row">
          <Button
            variant="paper"
            onClick={() => toast.success('Komentar terkirim.')}
          >
            Notifikasi berhasil
          </Button>
          <Button
            variant="paper"
            onClick={() =>
              toast.success('IF2110 dihapus dari mata kuliahmu.', {
                action: {
                  label: 'Urungkan',
                  onClick: () => toast.success('IF2110 dikembalikan.'),
                },
              })
            }
          >
            Dengan urungkan
          </Button>
          <Button
            variant="paper"
            onClick={() =>
              toast.error(
                'Komentar gagal terkirim. Periksa koneksimu, lalu coba lagi.',
              )
            }
          >
            Notifikasi gagal
          </Button>
        </div>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Isian</h3>
        <Searchbox
          label="Cari mata kuliah"
          placeholder="Cari kode atau nama mata kuliah"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Field label="Mata kuliah">
          <Select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="IF2110">IF2110 Algoritma dan Pemrograman II</option>
            <option value="IF2120">IF2120 Matematika Diskrit</option>
            <option value="IF3170">IF3170 Inteligensi Artifisial</option>
          </Select>
        </Field>
        <Field label="Catatan" hint="Maksimal 500 karakter">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </Field>
        <Seg
          label="Tema contoh"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'semua', label: 'Semua' },
            { value: 'akademik', label: 'Akademik' },
            { value: 'himpunan', label: 'Himpunan' },
          ]}
        />
        <Chips wrap label="Kategori">
          {(['akademik', 'himpunan', 'lomba'] as const).map((c) => (
            <Chip
              key={c}
              kind="checkbox"
              selected={cats.includes(c)}
              onSelectedChange={(on) =>
                setCats((v) => (on ? [...v, c] : v.filter((x) => x !== c)))
              }
            >
              {CATEGORY_NAMES[c]}
            </Chip>
          ))}
        </Chips>
        <ChipGroup
          label="Kelas IF2110"
          value={kelas}
          onChange={setKelas}
          deselectable
          options={[1, 2, 3].map((k) => ({ value: k, label: `K${k}` }))}
        />
        <Saved />
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Daftar dan permukaan</h3>
        <SectionHead
          title="Perlu ditindaklanjuti"
          line
          action={<LinkButton>Lihat semua</LinkButton>}
          level={4}
        />
        <RuledList>
          <li>
            <RowButton>
              <Item center>
                <Tile gold>
                  <IconFolder size={20} />
                </Tile>
                <span className="min-w-0 flex-1">
                  <span className="block t-sub">
                    Form Analisis Kondisi PIXEL
                  </span>
                  <span className="block t-cap text-fg-3">5 bagian</span>
                </span>
                <StatusTag status="open" />
              </Item>
            </RowButton>
          </li>
          <li>
            <RowButton current>
              <Item center>
                <Avatar initials="RP" />
                <span className="min-w-0 flex-1">
                  <span className="block t-sub">Raka Pratama</span>
                  <span className="block t-cap text-fg-3">1 jam lalu</span>
                </span>
              </Item>
            </RowButton>
          </li>
        </RuledList>
        <div className="demo-row">
          <Avatar initials="NP" shape="square" size="sm" />
          <Avatar initials="NP" shape="square" />
          <Avatar initials="NP" shape="square" size="lg" />
          <AvatarButton initials="NP" label="Profil" />
          <Avatar initials="RP" size="lg" />
        </div>
        <div className="demo-row" data-testid="labelled-marks">
          <Count value={3} label="3 belum dibaca" />
          <Tile label="Ruang terkunci">
            <IconKunci size={20} />
          </Tile>
        </div>
        <Segbar total={5} done={2} label="Bagian 2 dari 5" />
        <NoteBox icon={<IconKunci size={16} />}>
          Namamu tetap tersembunyi. Welfare hanya melihat nama ruang.
        </NoteBox>
        <Media alt="" ratio="16 / 10">
          <span className="t-cap text-cream">Foto</span>
        </Media>
      </div>
      <div className="sys-card" data-testid="garis-shared">
        <h3 className="t-heading">Bagian bersama</h3>
        <FactsList
          facts={[
            ['Email', '13525045@std.stei.itb.ac.id'],
            ['Program', 'Teknik Informatika'],
            ['Kampus', 'Ganesha'],
            ['Semester', '3 · Ganjil 2026/2027'],
          ]}
        />
        <div className="flex items-stretch gap-3">
          <UnreadBar unread />
          <span className="min-w-0 flex-1">
            <span className="block t-sub">Kuis 2 Algoritma</span>
            <Due urgent>Hari ini, 23.59</Due>
          </span>
        </div>
        <div className="flex items-stretch gap-3">
          <UnreadBar unread={false} />
          <span className="min-w-0 flex-1">
            <span className="block t-sub">Tugas Besar 1</span>
            <Due>Sen, 12 Okt, 23.59</Due>
          </span>
        </div>
        <Reactions>
          {(['grin', 'fire', 'party'] as const).map((k) => (
            <ReactionButton
              key={k}
              reaction={k}
              count={SAMPLE_REACTIONS[k] + (myReaction === k ? 1 : 0)}
              mine={myReaction === k}
              label={`${PIXEL_REACTION_LABELS[k]}, ${SAMPLE_REACTIONS[k] + (myReaction === k ? 1 : 0)} orang${myReaction === k ? ', termasuk kamu' : ''}`}
              onClick={() => setMyReaction((r) => (r === k ? null : k))}
            />
          ))}
          <ReactionStack reactions={['grin', 'fire', 'party']} />
        </Reactions>
        <Rating
          label="Secara keseluruhan, gimana penilaian kamu soal Welcoming Party 2025?"
          hint="1 = sangat kurang, 5 = sangat baik"
          value={rating}
          onChange={setRating}
        />
        <span className="flex items-center gap-2 t-sm text-fg-2">
          Cari
          <Kbd>⌘K</Kbd>
        </span>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Tanda merek</h3>
        <div className="demo-row">
          <HmifLogo width={40} alt="Logo HMIF ITB" />
          <HmifLogo width={54} alt="Logo HMIF ITB" />
          <Plaque style={{ padding: 12 }}>
            <HmifLogo width={72} plate alt="Logo HMIF ITB" />
          </Plaque>
        </div>
        <div className="demo-row">
          <Wordmark size={15} />
          <Wordmark size={20} />
          <Wordmark size={32} />
        </div>
        <div className="relative h-24 overflow-hidden rounded-card bg-hero text-on-hero">
          <span className="absolute top-6 left-4 t-display">Halo, Nadia</span>
          <Halftone className="absolute inset-y-0 right-0 w-54" />
        </div>
        <div className="demo-row">
          {GLYPH_KEYS.map((k) => {
            const G = GLYPHS[k];
            return (
              <span key={k} className="gal-tile-btn" title={ICON_LABELS[k]}>
                <span className="key">
                  <G />
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="sys-card">
        <h3 className="t-heading">Keadaan</h3>
        <EmptyState
          title="Belum ada pengumuman"
          text="Pengumuman dari HMIF muncul di sini."
        />
        <ErrorState
          title="Pengumuman gagal dimuat"
          text="Periksa koneksimu, lalu coba lagi."
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            setTimeout(() => {
              setRetries((n) => n + 1);
              setRetrying(false);
            }, 800);
          }}
        />
        <span className="t-cap text-fg-3" data-testid="retry-count">
          Dicoba lagi {retries}×
        </span>
        <OfflineBanner updatedAt="07.45" />
        <Skeleton label="Memuat kalender">
          <div className="grid gap-3">
            <SkeletonBar width="40%" height={14} />
            <SkeletonBlock height={72} />
            <SkeletonRow />
            <SkeletonRow tile={false} lines={['70%', '50%']} />
          </div>
        </Skeleton>
      </div>
    </div>
  );
}

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: ReactNode;
}[] = [
  { value: 'system', label: 'Sistem', icon: <IconSistem size={16} /> },
  { value: 'light', label: 'Terang', icon: <IconTerang size={16} /> },
  { value: 'dark', label: 'Gelap', icon: <IconGelap size={16} /> },
];

export default function Gallery() {
  const { preference, setPreference } = useTheme();
  useEffect(() => {
    const before = document.title;
    document.title = 'Sistem desain Garis · PIPS!';
    return () => {
      document.title = before;
    };
  }, []);
  return (
    <div className="gal">
      <main className="page">
        <header className="page-head">
          <div>
            <h1 className="t-display-l">Sistem desain Garis</h1>
            <p className="lede">
              Token, huruf, ikon, tanda merek, dan komponen PIPS!, dibangun dari
              prototipe yang dikunci 12 Oktober 2026. Halaman ini hanya ada di
              pengembangan dan staging.
            </p>
          </div>
          <div className="controls">
            <Seg
              label="Tampilan halaman"
              value={preference}
              onChange={setPreference}
              options={THEME_OPTIONS}
            />
          </div>
        </header>

        <section className="system" aria-labelledby="sys-h">
          <h2 className="t-display" id="sys-h">
            Sistem Garis: huruf, isi, warna, latar, ikon
          </h2>
          <SystemCards />
          <div className="sys-card">
            <h3 className="t-heading" id="icons-h">
              Ikon Garis: {ICON_KEYS.length} ikon dibuat khusus, tanpa pustaka
              ikon
            </h3>
            <div className="icons-grid" id="icons">
              {ICON_KEYS.map((k) => {
                const I = ICONS[k];
                return (
                  <div key={k} className="icon-cell">
                    <I size={24} />
                    {ICON_LABELS[k]}
                  </div>
                );
              })}
            </div>
            <p className="note">
              Ditampilkan di 24 px. Kisi 24 px, garis tampil 1,5 px di semua
              ukuran, ujung dan sudut siku, dibangun dari persegi dan garis
              datar. Warnanya mengikuti teks sehingga ikut berubah di mode
              gelap.
            </p>
          </div>
          <div className="kit" id="kit" data-testid="garis-kit">
            <KitPanel theme="light" label="Komponen di mode terang" />
            <KitPanel theme="dark" label="Komponen di mode gelap" />
          </div>
        </section>

        <section className="system" aria-labelledby="tok-h">
          <h2 className="t-display" id="tok-h">
            Semua token
          </h2>
          <div className="kit">
            <TokenPanel theme="light" />
            <TokenPanel theme="dark" />
          </div>
        </section>

        <section className="system" aria-labelledby="int-h">
          <h2 className="t-display" id="int-h">
            Komponen untuk dicoba
          </h2>
          <Interactive />
        </section>
      </main>
      <Toaster />
    </div>
  );
}
