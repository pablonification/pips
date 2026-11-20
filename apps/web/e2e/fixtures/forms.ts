/**
 * The form builder's sample data: the forms of the locked forms prototype (ops forms-v1, `garis/forms.js` F2) in the
 * API's shapes, who made each, who they are shared with, the answers they hold, and each persona's saved details
 * (Data diri). Everything is made up; "Form Analisis Kondisi PIXEL" is the real form's name, kept as a form made
 * before the builder (no owner). See NOTES.md.
 *
 * The forms live in `db.formStore`; the pretend API (support/handlers.ts, writes.ts) answers the builder's routes
 * and the member's new-form routes from it with the API's own rules (apps/api/src/lib/form-*.ts).
 */
import type {
  CollaboratorRole,
  FormAnswer,
  FormSection,
  ProfileField,
} from '../../../api/src/lib/form-model';
import type { SavedDetails } from '../../src/api/generated';
import { PEOPLE, wib, type PersonKey, type PersonaKey } from './prototype';

/** The address the harness gives the app's file storage (e2e/scripts/serve.mjs, VITE_MEDIA_URL). */
export const MEDIA_STORE = 'https://media.pips.test';

export const personId = (key: PersonKey) => `user-${PEOPLE[key].nim}`;

/** The people in the sample who hold a role (the prototype's PENGURUS_NAMES): only they can be given access. */
export const PENGURUS_PEOPLE: readonly PersonKey[] = [
  'raka',
  'aulia',
  'salsa',
  'dimas',
  'kevin',
];

export interface StoredResponse {
  id: string;
  userId: string;
  answers: FormAnswer[];
  profile: Partial<Record<ProfileField, string>>;
  submittedAt: string;
  updatedAt: string | null;
}

/** A form as the API stores it (`forms`, `form_collaborators`, `form_responses`). */
export interface StoredForm {
  id: string;
  slug: string;
  slugCustom: boolean;
  title: string;
  description: string | null;
  sections: FormSection[];
  requestedFields: ProfileField[];
  eligibleAngkatan: number[];
  opensAt: string | null;
  closesAt: string | null;
  isActive: boolean;
  allowEdit: boolean;
  thanks: string | null;
  publishedAt: string | null;
  ownerId: string | null;
  shared: Array<{ userId: string; role: CollaboratorRole }>;
  responses: StoredResponse[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

const sec = (
  id: string,
  title: string,
  questions: FormSection['questions'],
) => ({
  id,
  title,
  questions,
});

const FIRST = [
  'Alya',
  'Bagas',
  'Citra',
  'Dafa',
  'Elisa',
  'Fajar',
  'Gita',
  'Hafiz',
  'Indah',
  'Jovan',
  'Kirana',
  'Luthfi',
];
const LAST = [
  'Pratiwi',
  'Nugraha',
  'Saputra',
  'Wulandari',
  'Hidayat',
  'Kusuma',
  'Ramadhan',
  'Lestari',
];

/** A made-up member for the i-th sample response: NIMs with a sequence of 900 or more, never a real member's. */
function sampleMember(i: number, years: number[]) {
  const year = years[i % years.length];
  const sti = Math.floor(i / years.length) % 2 === 1;
  const nim = `${sti ? '182' : '135'}${String(year).slice(2)}${900 + Math.floor(i / (years.length * 2))}`;
  return {
    id: `user-${nim}`,
    nim,
    fullName: `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
    major: sti ? 'Sistem dan Teknologi Informasi' : 'Teknik Informatika',
    angkatan: String(year),
  };
}

const profileOf = (
  m: ReturnType<typeof sampleMember>,
  fields: ProfileField[],
  i: number,
): Partial<Record<ProfileField, string>> => {
  const all: Partial<Record<ProfileField, string>> = {
    fullName: m.fullName,
    nim: m.nim,
    major: m.major,
    angkatan: m.angkatan,
    campus: i % 4 === 3 ? 'Jatinangor' : 'Ganesha',
    email: `${m.nim}@std.stei.itb.ac.id`,
    whatsapp: `0812-5550-${String(900 + (i % 100)).padStart(4, '0')}`,
    emergencyContact: `${LAST[i % LAST.length]} (${i % 2 ? 'ayah' : 'ibu'}) · 0813-5550-${String(900 + (i % 100)).padStart(4, '0')}`,
    health: i % 5 === 0 ? 'Alergi udang' : 'Tidak ada',
  };
  return Object.fromEntries(
    fields.flatMap((f) => (all[f] ? [[f, all[f]]] : [])),
  );
};

/** `count` responses spread back from `last`, one every 7–56 minutes, newest first in time order reversed. */
function sampleResponses(
  form: Pick<StoredForm, 'id' | 'requestedFields' | 'eligibleAngkatan'>,
  count: number,
  last: string,
  answer: (i: number) => FormAnswer[],
): StoredResponse[] {
  const out: StoredResponse[] = [];
  let t = Date.parse(last);
  for (let i = 0; i < count; i++) {
    const m = sampleMember(i, form.eligibleAngkatan);
    out.push({
      id: `${form.id}-r${i + 1}`,
      userId: m.id,
      answers: answer(i),
      profile: profileOf(m, form.requestedFields, i),
      submittedAt: new Date(t).toISOString(),
      updatedAt: i === 3 ? new Date(t + 3_600_000).toISOString() : null,
    });
    t -= (7 + ((i * 13) % 50)) * 60_000;
  }
  return out.reverse();
}

const pick = <T>(xs: readonly T[], i: number) => xs[i % xs.length];

const MAKRAB_SECTIONS: FormSection[] = [
  sec('s1', 'Kehadiran', [
    {
      id: 'k1',
      label: 'Bisa ikut dua hari penuh?',
      type: 'radio',
      options: ['Ya, dua hari penuh', 'Menyusul Sabtu malam', 'Belum pasti'],
    },
    {
      id: 'k2',
      label: 'Kira-kira sampai jam berapa?',
      type: 'time',
      dependsOn: { questionId: 'k1', value: 'Menyusul Sabtu malam' },
    },
    {
      id: 'k3',
      label: 'Berangkat dari mana?',
      type: 'dropdown',
      options: [
        'Kampus Ganesha, bus bareng',
        'Kampus Jatinangor, bus bareng',
        'Langsung ke lokasi',
      ],
    },
  ]),
  sec('s2', 'Selama acara', [
    { id: 'k4', label: 'Nama panggilan untuk name tag', type: 'text' },
    {
      id: 'k5',
      label: 'Mau ikut kegiatan apa saja?',
      type: 'checkbox',
      options: ['Api unggun', 'Games angkatan', 'Jelajah pagi', 'Masak bareng'],
      other: true,
    },
    {
      id: 'k6',
      label: 'Seberapa semangat kamu ikut makrab?',
      type: 'rating',
      scale: { min: 1, max: 5, minLabel: 'Biasa aja', maxLabel: 'Nggak sabar' },
    },
  ]),
  sec('s3', 'Administrasi', [
    {
      id: 'k7',
      label: 'Bukti transfer iuran',
      type: 'file',
      description: 'Rp75.000 ke rekening bendahara angkatan.',
    },
    {
      id: 'k8',
      label: 'Mau ambil gelang peserta di sekre tanggal berapa?',
      type: 'date',
      description: 'Gelang bisa diambil 19–23 Oktober.',
    },
    {
      id: 'k9',
      label: 'Ada yang perlu panitia tahu?',
      type: 'textarea',
      optional: true,
    },
  ]),
];

/** The forms, as fresh copies. Ids are the prototype's. */
export function sampleForms(): StoredForm[] {
  const base = {
    slugCustom: true,
    isActive: true,
    thanks: 'Terima kasih sudah mengisi!',
    allowEdit: false,
    shared: [] as StoredForm['shared'],
    responses: [] as StoredResponse[],
    order: 0,
  };
  const makrab: StoredForm = {
    ...base,
    id: 'makrab',
    slug: 'makrab-2026',
    title: 'Daftar Makrab HMIF 2026',
    description:
      'Malam keakraban angkatan 2025, Sabtu–Minggu 24–25 Oktober di Lembang. Isi sebelum kuota bus penuh.',
    sections: MAKRAB_SECTIONS,
    requestedFields: [
      'fullName',
      'nim',
      'campus',
      'whatsapp',
      'emergencyContact',
      'health',
    ],
    eligibleAngkatan: [2025],
    opensAt: wib(10, 5, 10, 0),
    closesAt: wib(10, 18, 23, 59),
    publishedAt: wib(10, 4, 20, 0),
    allowEdit: true,
    thanks: 'Sampai ketemu di makrab!',
    ownerId: personId('raka'),
    shared: [
      { userId: personId('aulia'), role: 'edit' },
      { userId: personId('dimas'), role: 'view' },
    ],
    createdAt: wib(10, 2, 9, 0),
    updatedAt: wib(10, 4, 20, 0),
  };
  makrab.responses = sampleResponses(makrab, 87, wib(10, 8, 12, 50), (i) => {
    const late = i % 9 === 4;
    const k1 = late
      ? 'Menyusul Sabtu malam'
      : pick(['Ya, dua hari penuh', 'Ya, dua hari penuh', 'Belum pasti'], i);
    return [
      { questionId: 'k1', answer: k1 },
      ...(late
        ? [{ questionId: 'k2', answer: pick(['19:30', '21:00', '20:15'], i) }]
        : []),
      {
        questionId: 'k3',
        answer: pick(MAKRAB_SECTIONS[0].questions[2].options!, i),
      },
      {
        questionId: 'k4',
        answer: pick(['Alya', 'Bagas', 'Cit', 'Dafa', 'Lis'], i),
      },
      i % 7 === 2
        ? {
            questionId: 'k5',
            answer: ['Api unggun', '__other'],
            other: 'Karaoke',
          }
        : {
            questionId: 'k5',
            answer: [
              pick(['Api unggun', 'Games angkatan', 'Jelajah pagi'], i),
              'Masak bareng',
            ].slice(0, 1 + (i % 2)),
          },
      { questionId: 'k6', answer: String(3 + (i % 3)) },
      {
        questionId: 'k7',
        answer: `${MEDIA_STORE}/makrab${i + 1}-bukti-transfer.jpg`,
      },
      { questionId: 'k8', answer: `2026-10-${19 + (i % 5)}` },
      ...(i % 6 === 0
        ? [{ questionId: 'k9', answer: 'Aku vegetarian, tolong disiapkan ya.' }]
        : []),
    ];
  });

  const belajar: StoredForm = {
    ...base,
    id: 'belajar',
    slug: 'belajar-bareng-uts',
    title: 'Pilih jadwal belajar bareng UTS',
    description: 'Tutor sebaya untuk IF2110 dan IF2123 sebelum UTS.',
    sections: [
      sec('s1', '', [
        {
          id: 'b1',
          label: 'Mata kuliah mana yang mau kamu ikuti?',
          type: 'checkbox',
          options: [
            'IF2110 Algoritma dan Pemrograman 2',
            'IF2123 Aljabar Linier dan Geometri',
          ],
        },
        {
          id: 'b2',
          label: 'Lebih enak kapan?',
          type: 'radio',
          options: ['Sore, 16.00–18.00', 'Malam, 19.00–21.00'],
        },
      ]),
    ],
    requestedFields: ['fullName', 'nim', 'whatsapp'],
    eligibleAngkatan: [2025],
    opensAt: wib(10, 12, 10, 0),
    closesAt: wib(10, 16, 18, 0),
    publishedAt: wib(10, 7, 9, 0),
    ownerId: personId('aulia'),
    shared: [{ userId: personId('raka'), role: 'edit' }],
    createdAt: wib(10, 6, 9, 0),
    updatedAt: wib(10, 7, 9, 0),
  };

  const welpar: StoredForm = {
    ...base,
    id: 'welpar',
    slug: 'feedback-welpar-2025',
    title: 'Feedback Welcoming Party 2025',
    description:
      'Cerita singkat soal Welcoming Party 2025 supaya acara berikutnya lebih seru.',
    sections: [
      sec('s1', '', [
        {
          id: 'w1',
          label: 'Secara keseluruhan, gimana Welcoming Party 2025?',
          type: 'rating',
          scale: {
            min: 1,
            max: 5,
            minLabel: 'Sangat kurang',
            maxLabel: 'Sangat baik',
          },
        },
        {
          id: 'w2',
          label: 'Bagian mana yang paling kamu nikmati?',
          type: 'checkbox',
          options: [
            'Games angkatan',
            'Penampilan',
            'Makan bareng',
            'Kenalan dengan kakak tingkat',
          ],
          other: true,
        },
        {
          id: 'w3',
          label: 'Apa yang perlu diperbaiki untuk tahun depan?',
          type: 'textarea',
          optional: true,
        },
      ]),
    ],
    requestedFields: [],
    eligibleAngkatan: [2025],
    opensAt: wib(9, 20, 9, 0),
    closesAt: wib(10, 4, 23, 59),
    publishedAt: wib(9, 19, 20, 0),
    ownerId: personId('salsa'),
    shared: [{ userId: personId('raka'), role: 'view' }],
    createdAt: wib(9, 18, 9, 0),
    updatedAt: wib(9, 19, 20, 0),
  };
  welpar.responses = sampleResponses(welpar, 96, wib(10, 4, 22, 10), (i) => [
    { questionId: 'w1', answer: String(2 + (i % 4)) },
    {
      questionId: 'w2',
      answer: [pick(['Games angkatan', 'Penampilan', 'Makan bareng'], i)],
    },
    ...(i % 4 === 0
      ? [
          {
            questionId: 'w3',
            answer: 'Sound system-nya kurang keras di belakang.',
          },
        ]
      : []),
  ]);

  const suara: StoredForm = {
    ...base,
    id: 'suara',
    slug: 'evaluasi-tengah-periode',
    title: 'Evaluasi tengah periode HMIF',
    description:
      'Tiga pertanyaan soal kegiatan HMIF semester ini. Jawab sejujurnya.',
    sections: [
      sec('s1', '', [
        {
          id: 'e1',
          label: 'Seberapa puas kamu dengan kegiatan HMIF semester ini?',
          type: 'rating',
          scale: {
            min: 1,
            max: 5,
            minLabel: 'Tidak puas',
            maxLabel: 'Sangat puas',
          },
        },
        {
          id: 'e2',
          label: 'Kegiatan mana yang paling terasa manfaatnya?',
          type: 'checkbox',
          options: [
            'Akademik: tutor dan bank soal',
            'Acara angkatan',
            'Info lomba dan karier',
            'Curhat Yuk!',
          ],
          other: true,
        },
        {
          id: 'e3',
          label: 'Apa yang paling perlu diperbaiki?',
          type: 'textarea',
          optional: true,
        },
      ]),
    ],
    requestedFields: [],
    eligibleAngkatan: [2023, 2024, 2025],
    opensAt: wib(10, 6, 9, 0),
    closesAt: wib(10, 20, 23, 59),
    publishedAt: wib(10, 5, 20, 0),
    thanks: 'Terima kasih, suaramu masuk.',
    ownerId: personId('dimas'),
    createdAt: wib(10, 5, 9, 0),
    updatedAt: wib(10, 5, 20, 0),
  };
  suara.responses = sampleResponses(suara, 214, wib(10, 8, 11, 0), (i) => [
    { questionId: 'e1', answer: String(1 + (i % 5)) },
    {
      questionId: 'e2',
      answer: [
        pick(
          [
            'Akademik: tutor dan bank soal',
            'Acara angkatan',
            'Info lomba dan karier',
            'Curhat Yuk!',
          ],
          i,
        ),
      ],
    },
  ]);

  const ta: StoredForm = {
    ...base,
    id: 'ta',
    slug: 'rencana-ta-2023',
    title: 'Survei rencana tugas akhir',
    description:
      'Untuk angkatan 2023: gambaran topik dan jadwal tugas akhirmu, supaya HMIF bisa menyiapkan sesi berbagi.',
    sections: [
      sec('s1', '', [
        {
          id: 't1',
          label: 'Sudah punya topik tugas akhir?',
          type: 'radio',
          options: ['Sudah', 'Masih memilih', 'Belum sama sekali'],
        },
        {
          id: 't2',
          label: 'Sesi berbagi apa yang paling kamu butuhkan?',
          type: 'textarea',
          optional: true,
        },
      ]),
    ],
    requestedFields: ['fullName', 'nim', 'major'],
    eligibleAngkatan: [2023],
    opensAt: wib(10, 1, 9, 0),
    closesAt: wib(10, 31, 23, 59),
    publishedAt: wib(9, 30, 20, 0),
    ownerId: personId('dimas'),
    createdAt: wib(9, 29, 9, 0),
    updatedAt: wib(9, 30, 20, 0),
  };
  ta.responses = sampleResponses(ta, 41, wib(10, 8, 9, 0), (i) => [
    {
      questionId: 't1',
      answer: pick(['Sudah', 'Masih memilih', 'Belum sama sekali'], i),
    },
  ]);

  const wisuda: StoredForm = {
    ...base,
    id: 'wisuda',
    slug: 'daftar-panitia-wisuda-oktober',
    slugCustom: false,
    title: 'Daftar panitia Wisuda Oktober',
    description: 'Bantu arak-arakan wisudawan HMIF, Sabtu 24 Oktober.',
    sections: [
      sec('s1', 'Peran', [
        {
          id: 'p1',
          label: 'Mau bantu di divisi apa?',
          type: 'radio',
          options: ['Acara', 'Dekorasi', 'Dokumentasi', 'Konsumsi'],
        },
        {
          id: 'p2',
          label: 'Bawa kamera sendiri?',
          type: 'radio',
          options: ['Ya', 'Tidak'],
          dependsOn: { questionId: 'p1', value: 'Dokumentasi' },
        },
        {
          id: 'p3',
          label: 'Hari apa saja kamu bisa?',
          type: 'checkbox',
          options: ['Jumat 23 Oktober, gladi', 'Sabtu 24 Oktober, hari-H'],
        },
      ]),
      sec('s2', 'Tentang kamu', [
        { id: 'p4', label: 'Nomor WhatsApp', type: 'text' },
        {
          id: 'p5',
          label: 'Seberapa padat kuliahmu minggu itu?',
          type: 'rating',
          scale: { min: 1, max: 5, minLabel: 'Longgar', maxLabel: 'Padat' },
        },
        {
          id: 'p6',
          label: 'Pengalaman kepanitiaan sebelumnya',
          type: 'textarea',
          optional: true,
        },
      ]),
    ],
    requestedFields: ['fullName', 'nim', 'whatsapp'],
    eligibleAngkatan: [],
    opensAt: null,
    closesAt: null,
    isActive: false,
    publishedAt: null,
    allowEdit: true,
    ownerId: personId('raka'),
    createdAt: wib(10, 7, 21, 0),
    updatedAt: wib(10, 8, 10, 0),
  };

  const pixel: StoredForm = {
    ...base,
    id: 'pixel',
    slug: 'pixel-analisis-kondisi-2025',
    title: 'Form Analisis Kondisi PIXEL',
    description: 'Bantu HMIF kenalan lebih dekat sama kamu, angkatan 2025.',
    // Its questions are the legacy fixture's (db.formDetails.pixel); the builder reads them from there.
    sections: [],
    requestedFields: [],
    eligibleAngkatan: [2025],
    opensAt: wib(9, 12, 13, 0),
    closesAt: null,
    publishedAt: wib(9, 1),
    thanks: null,
    ownerId: null,
    order: 1,
    createdAt: wib(9, 1),
    updatedAt: wib(9, 1),
  };

  return [makrab, belajar, welpar, suara, ta, wisuda, pixel];
}

/** Each persona's saved details (the prototype's SAVED0). Nadia hasn't given Kondisi kesehatan, which Makrab requests. */
export function sampleDetails(persona: PersonaKey | null): SavedDetails {
  const none: SavedDetails = {
    whatsapp: null,
    line: null,
    instagram: null,
    address: null,
    hometown: null,
    emergencyContact: null,
    health: null,
    birthDate: null,
    studentCardPhoto: null,
    photo: null,
  };
  if (persona === 'anggota')
    return {
      ...none,
      whatsapp: '0812-5550-0945',
      line: 'nadiaputri.id',
      hometown: 'Semarang',
      emergencyContact: {
        name: 'Ratna Dewi',
        relation: 'Ibu',
        phone: '0813-5550-0911',
      },
      studentCardPhoto: `${MEDIA_STORE}/nadia1-ktm-nadia.jpg`,
    };
  if (persona === 'pengurus')
    return {
      ...none,
      whatsapp: '0812-5550-0987',
      line: 'rakapratama',
      instagram: '@rakaprtm',
      address: 'Kos Cisitu Indah, kamar 9, Bandung',
      hometown: 'Surabaya',
      emergencyContact: {
        name: 'Hendra Pratama',
        relation: 'Ayah',
        phone: '0813-5550-0922',
      },
      health: 'Tidak ada',
      birthDate: '2006-06-21',
      studentCardPhoto: `${MEDIA_STORE}/raka1-ktm-raka.jpg`,
    };
  return none;
}
