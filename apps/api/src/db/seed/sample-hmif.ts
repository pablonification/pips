/**
 * A small made-up HMIF for a local database: every person, number and message here is invented. A student number's
 * sequence is 900 or more, which no member can hold. Read by `src/db/seed.ts`; nothing here touches a database.
 *
 * Dates follow the day the seed runs, so Kalender has events this month and next, and a course is taken in the
 * semester the API calls current.
 */
import type {
  angkatan,
  calendarEvent,
  calendarGroup,
  categories,
  chatroomMessageReads,
  chatroomMessages,
  chatrooms,
  comments,
  competitions,
  courses,
  infoAngkatan,
  infoCategories,
  infos,
  reactions,
  testimonies,
  userCourses,
  userRoles,
  users,
} from '../schema';

type Row<T extends { $inferInsert: unknown }> = T['$inferInsert'];

const email = (nim: string) => `${nim}@std.stei.itb.ac.id`;

/** The seeded members by what they are for. Sign in as one with the login bypass (CONTRIBUTING.md). */
export const SAMPLE_MEMBERS = {
  anggota: { id: 'seed-anggota', nim: '13525901' },
  pengurus: { id: 'seed-pengurus', nim: '13524901' },
  welfare: { id: 'seed-welfare', nim: '18224902' },
  otherAngkatan: { id: 'seed-angkatan-lain', nim: '13524903' },
} as const;

const M = SAMPLE_MEMBERS;

/** A time in WIB (UTC+7) on a day counted from `now`, kept inside `now`'s month when `sameMonth` is set. */
function wib(now: Date, dayOffset: number, hour: number, sameMonth = false) {
  const local = new Date(now.getTime() + 7 * 3600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  let d = local.getUTCDate() + dayOffset;
  if (sameMonth) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    d = Math.min(d, lastDay);
  }
  return new Date(Date.UTC(y, m, d, hour - 7));
}

/** A time in WIB on day `day` of the month after `now`'s. */
function nextMonth(now: Date, day: number, hour: number) {
  const local = new Date(now.getTime() + 7 * 3600_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, day, hour - 7),
  );
}

/** The semester the API calls current on `now`'s date (`getCurrentSemesterCodeAndYear` in course.repo.ts). */
export function currentSemester(now: Date) {
  return now.getMonth() <= 5
    ? {
        semesterCodeTaken: 'Genap' as const,
        semesterYearTaken: now.getFullYear() - 1,
      }
    : {
        semesterCodeTaken: 'Ganjil' as const,
        semesterYearTaken: now.getFullYear(),
      };
}

export function sampleHmif(now: Date) {
  const { semesterCodeTaken, semesterYearTaken } = currentSemester(now);
  // The Akademik calendar group of a mandatory course in semester 3 (calendar.repo.ts, getCalendarGroupByCourseId).
  const secondYearCode = `if${semesterYearTaken - 1}`;

  const angkatanRows: Array<Row<typeof angkatan>> = [
    { id: 'seed-angkatan-2024', year: 2024, name: 'Contoh 2024' },
    { id: 'seed-angkatan-2025', year: 2025, name: 'PIXEL' },
  ];

  const userRows: Array<Row<typeof users>> = [
    {
      id: M.anggota.id,
      nim: M.anggota.nim,
      email: email(M.anggota.nim),
      fullName: 'Nadia Contoh Lestari',
      major: 'IF',
      region: 'Ganesha',
      angkatan: 2025,
      gender: 'F',
      membershipStatus: 'Anggota Muda',
    },
    {
      id: M.pengurus.id,
      nim: M.pengurus.nim,
      email: email(M.pengurus.nim),
      fullName: 'Raka Contoh Pratama',
      major: 'IF',
      region: 'Ganesha',
      angkatan: 2024,
      gender: 'M',
      membershipStatus: 'Anggota Biasa',
    },
    {
      id: M.welfare.id,
      nim: M.welfare.nim,
      email: email(M.welfare.nim),
      fullName: 'Sari Contoh Wulandari',
      major: 'STI',
      region: 'Jatinangor',
      angkatan: 2024,
      gender: 'F',
      membershipStatus: 'Anggota Biasa',
    },
    {
      id: M.otherAngkatan.id,
      nim: M.otherAngkatan.nim,
      email: email(M.otherAngkatan.nim),
      fullName: 'Bima Contoh Saputra',
      major: 'IF',
      region: 'Ganesha',
      angkatan: 2024,
      gender: 'M',
      membershipStatus: 'Anggota Biasa',
    },
  ];

  const roleRows: Array<Row<typeof userRoles>> = [
    { userId: M.pengurus.id, role: 'admin' },
    { userId: M.pengurus.id, role: 'akademik' },
    { userId: M.welfare.id, role: 'curhatadmin' },
  ];

  // Akademik can be muted (requiredPush false); Himpunan always notifies.
  const categoryRows: Array<Row<typeof categories>> = [
    {
      id: 'seed-kategori-akademik',
      name: 'Akademik',
      requiredPush: false,
      isForInfo: true,
    },
    {
      id: 'seed-kategori-himpunan',
      name: 'Himpunan',
      requiredPush: true,
      isForInfo: true,
    },
  ];

  const courseRows: Array<Row<typeof courses>> = [
    ['IF2110', 'Algoritma dan Struktur Data', 4],
    ['IF2120', 'Matematika Diskrit', 3],
    ['IF2121', 'Logika Komputasional', 2],
    ['IF2130', 'Organisasi dan Arsitektur Komputer', 3],
  ].map(([code, name, credits]) => ({
    id: `seed-matkul-${String(code).toLowerCase()}`,
    curriculumYear: 2024,
    major: 'IF' as const,
    type: 'Mandatory' as const,
    semester: 3,
    semesterCode: 'Ganjil' as const,
    code: String(code),
    name: String(name),
    credits: Number(credits),
  }));

  const userCourseRows: Array<Row<typeof userCourses>> = [
    'seed-matkul-if2110',
    'seed-matkul-if2120',
  ].map((courseId) => ({
    userId: M.anggota.id,
    courseId,
    class: 1,
    semesterCodeTaken,
    semesterYearTaken,
  }));

  const infoRows: Array<Row<typeof infos>> = [
    {
      id: 'seed-info-semua',
      creatorId: M.pengurus.id,
      title: 'Rapat anggota akhir semester',
      content:
        'Halo semuanya! Rapat anggota akhir semester diadakan di aula. Bawa ide kamu untuk kegiatan semester depan.',
      createdAt: wib(now, -3, 9),
      isForAngkatan: false,
      isForGroups: false,
    },
    {
      id: 'seed-info-akademik',
      creatorId: M.pengurus.id,
      title: 'Jadwal kuis Struktur Data',
      content:
        'Kuis Algoritma dan Struktur Data minggu ini membahas pohon dan graf. Ruangannya sama seperti kuliah.',
      createdAt: wib(now, -2, 10),
      isForAngkatan: false,
      isForGroups: false,
    },
    {
      id: 'seed-info-pixel',
      creatorId: M.pengurus.id,
      title: 'Kumpul angkatan PIXEL hari Sabtu',
      content: 'Kumpul santai angkatan PIXEL di taman. Ada makanan ringan!',
      createdAt: wib(now, -1, 16),
      isForAngkatan: true,
      isForGroups: false,
    },
    {
      id: 'seed-info-2024',
      creatorId: M.pengurus.id,
      title: 'Pendataan peminatan angkatan 2024',
      content: 'Angkatan 2024, isi pendataan peminatan sebelum akhir bulan.',
      createdAt: wib(now, -1, 11),
      isForAngkatan: true,
      isForGroups: false,
    },
  ];

  const infoAngkatanRows: Array<Row<typeof infoAngkatan>> = [
    { infoId: 'seed-info-pixel', angkatanId: 'seed-angkatan-2025' },
    { infoId: 'seed-info-2024', angkatanId: 'seed-angkatan-2024' },
  ];

  const infoCategoryRows: Array<Row<typeof infoCategories>> = [
    { infoId: 'seed-info-semua', categoryId: 'seed-kategori-himpunan' },
    { infoId: 'seed-info-akademik', categoryId: 'seed-kategori-akademik' },
    { infoId: 'seed-info-pixel', categoryId: 'seed-kategori-himpunan' },
    { infoId: 'seed-info-2024', categoryId: 'seed-kategori-himpunan' },
  ];

  const commentRows: Array<Row<typeof comments>> = [
    {
      id: 'seed-komentar-1',
      repliedInfoId: 'seed-info-semua',
      creatorId: M.otherAngkatan.id,
      content: 'Siap, nanti aku datang!',
      createdAt: wib(now, -2, 12),
    },
  ];

  const reactionRows: Array<Row<typeof reactions>> = [
    {
      id: 'seed-reaksi-1',
      creatorId: M.otherAngkatan.id,
      infoId: 'seed-info-semua',
      reaction: 'fire',
    },
    {
      id: 'seed-reaksi-2',
      creatorId: M.welfare.id,
      commentId: 'seed-komentar-1',
      reaction: 'grin',
    },
  ];

  const calendarGroupRows: Array<Row<typeof calendarGroup>> = [
    {
      id: 'seed-kalender-akademik',
      name: `IF ${semesterYearTaken - 1}`,
      category: 'akademik',
      code: secondYearCode,
      googleCalendarUrl: 'seed-akademik@example.com',
    },
    {
      id: 'seed-kalender-himpunan',
      name: 'Himpunan',
      category: 'himpunan',
      code: null,
      googleCalendarUrl: 'seed-himpunan@example.com',
    },
  ];

  // Stored as the API stores them after Google answers; the seed makes no Google call.
  const event = (
    id: string,
    fields: Omit<
      Row<typeof calendarEvent>,
      'id' | 'googleCalendarUrl' | 'googleCalendarId'
    >,
  ): Row<typeof calendarEvent> => ({
    id,
    googleCalendarUrl: 'https://calendar.example.com/event',
    googleCalendarId: id,
    ...fields,
  });
  const akademik = (courseId: string) => ({
    calendarGroupId: 'seed-kalender-akademik',
    courseId,
    category: 'akademik',
    academicYear: semesterYearTaken,
    academicSemesterCode: semesterCodeTaken,
  });
  const himpunan = {
    calendarGroupId: 'seed-kalender-himpunan',
    category: 'himpunan',
  };

  const eventRows: Array<Row<typeof calendarEvent>> = [
    event('seed-acara-kuis', {
      ...akademik('seed-matkul-if2110'),
      title: 'Kuis Algoritma dan Struktur Data',
      description: 'Pohon dan graf.',
      start: wib(now, 1, 9, true),
      end: wib(now, 1, 11, true),
    }),
    event('seed-acara-makrab', {
      ...himpunan,
      title: 'Malam keakraban HMIF',
      description: 'Kenalan dengan angkatan lain.',
      start: wib(now, 2, 18, true),
      end: wib(now, 2, 21, true),
    }),
    event('seed-acara-uts', {
      ...akademik('seed-matkul-if2120'),
      title: 'UTS Matematika Diskrit',
      description: 'Bab 1 sampai 5.',
      start: nextMonth(now, 10, 13),
      end: nextMonth(now, 10, 15),
    }),
    event('seed-acara-seminar', {
      ...himpunan,
      title: 'Seminar karier informatika',
      description: 'Cerita alumni tentang dunia kerja.',
      start: nextMonth(now, 15, 10),
      end: nextMonth(now, 15, 12),
    }),
  ];

  const competitionRows: Array<Row<typeof competitions>> = [
    {
      id: 'seed-lomba-1',
      name: 'Lomba Contoh Pemrograman Nasional',
      organizer: 'Panitia Contoh',
      registrationStart: wib(now, -7, 0),
      registrationDeadline: wib(now, 21, 23),
      price: 'Gratis',
      sourceUrl: 'https://example.com/lomba',
      registrationUrl: 'https://example.com/lomba/daftar',
      categories: ['Competitive Programming'],
    },
  ];

  const testimonyRows: Array<Row<typeof testimonies>> = [
    {
      id: 'seed-testi-1',
      courseId: 'seed-matkul-if2110',
      overview: 'Materinya padat tapi seru kalau rajin latihan.',
      assignments: 'Tugas besar berkelompok, mulai dari awal.',
      lecturer_review: 'Penjelasannya runtut.',
    },
  ];

  const chatroomRows: Array<Row<typeof chatrooms>> = [
    { id: 'seed-curhat-1', userId: M.anggota.id, title: 'Tugas menumpuk' },
  ];

  const chatroomMessageRows: Array<Row<typeof chatroomMessages>> = [
    {
      id: 'seed-pesan-1',
      chatroomId: 'seed-curhat-1',
      userId: M.anggota.id,
      content:
        'Halo kak, minggu ini tugasku menumpuk dan aku bingung mulai dari mana.',
      createdAt: wib(now, -1, 20),
    },
    {
      id: 'seed-pesan-2',
      chatroomId: 'seed-curhat-1',
      userId: M.welfare.id,
      content:
        'Halo, makasih sudah cerita. Coba tulis dulu semua tugasnya, nanti kita urutkan bareng ya.',
      createdAt: wib(now, -1, 21),
    },
  ];

  // The room's owner and Welfare have read the conversation so far.
  const chatroomReadRows: Array<Row<typeof chatroomMessageReads>> =
    chatroomMessageRows.flatMap((message) =>
      [M.anggota.id, M.welfare.id].map((userId) => ({
        userId,
        chatroomMessageId: String(message.id),
      })),
    );

  return {
    angkatanRows,
    userRows,
    roleRows,
    categoryRows,
    courseRows,
    userCourseRows,
    infoRows,
    infoAngkatanRows,
    infoCategoryRows,
    commentRows,
    reactionRows,
    calendarGroupRows,
    eventRows,
    competitionRows,
    testimonyRows,
    chatroomRows,
    chatroomMessageRows,
    chatroomReadRows,
  };
}
