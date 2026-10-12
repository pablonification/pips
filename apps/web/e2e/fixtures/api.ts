/**
 * Typed API fixtures: the prototype's sample data (prototype.ts) in the real API's shapes.
 *
 * Every value is typed with the generated API models in src/api/generated, so `pnpm typecheck` fails when the API
 * changes shape. `buildDb(persona)` returns a fresh, mutable copy for one test; the default handlers in
 * support/handlers.ts read from it, and a test's own write handlers may change it.
 */
import type {
  AdminFormResponseItem,
  Angkatan,
  CalendarEvent,
  Category,
  Chatroom,
  ChatroomMessage,
  CommentWithReactions,
  Competition,
  Course,
  FormDetail,
  FormListItem,
  FormQuestion,
  FormResponse,
  Info,
  InternshipDepartment,
  InternshipSubmission,
  ListChatroom,
  Markdown,
  ReactionAggregate,
  Testimoni,
  User,
  UserCourse,
  UserGroups,
  UserWithRoles,
} from '../../src/api/generated';
import {
  ANGKATAN,
  CATEGORIES,
  COURSES,
  EVENTS,
  LIVE,
  LOMBA,
  MEMBERS,
  MY_COURSES,
  NOW,
  PEOPLE,
  PERSONAS,
  PERSON_OF,
  PIXEL_FORM,
  POSTS,
  READ0,
  REACTIONS,
  ROLE_NAMES,
  ROOMS,
  SEMESTER,
  TESTI,
  email,
  wib,
  type PersonKey,
  type PersonaKey,
  type ProtoPost,
  type ReactionKey,
} from './prototype';

export { NOW, PERSONAS, type PersonaKey };

/** Same-origin URLs that the mock layer answers with generated images (support/media.ts). */
export const avatarUrl = (nim: string) => `/__e2e__/avatar/${nim}.svg`;
export const mediaUrl = (name: string) => `/__e2e__/media/${name}.svg`;

const userId = (nim: string) => `user-${nim}`;
const majorOf = (nim: string): 'IF' | 'STI' =>
  nim.startsWith('182') ? 'STI' : 'IF';

export function personUser(key: PersonKey): User {
  const p = PEOPLE[key];
  return {
    id: userId(p.nim),
    nim: p.nim,
    email: email(p.nim),
    fullName: p.name,
    major: majorOf(p.nim),
    picture: avatarUrl(p.nim),
    region: 'Ganesha',
    angkatan: p.ang,
    gender: p.gender,
    membershipStatus: 'Anggota Biasa',
  };
}

export function personaUser(persona: PersonaKey): UserWithRoles {
  const p = PERSONAS[persona];
  return {
    ...personUser(PERSON_OF[persona]),
    major: p.major,
    region: p.kampus,
    membershipStatus: p.status,
    roles: [...p.roles],
  };
}

export const angkatanList: Angkatan[] = ANGKATAN.map((a) => ({
  id: `angkatan-${a.year}`,
  year: a.year,
  name: a.name ?? '',
}));

export const categories: Category[] = CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  requiredPush: c.required,
}));

export const courses: Course[] = COURSES.map((c) => ({
  id: `course-${c.code}`,
  curriculumYear: 2024,
  major: c.major,
  type: c.sem === 0 ? 'Elective' : 'Mandatory',
  semester: c.sem === 0 ? null : c.sem,
  semesterCode: c.sem === 0 ? null : c.sem % 2 ? 'Ganjil' : 'Genap',
  code: c.code,
  name: c.name,
  credits: c.sks,
  dingdongUrl: c.drive
    ? `https://drive.google.com/drive/folders/e2e-${c.code}`
    : null,
  isActive: true,
}));
const courseByCode = (code: string) => {
  const c = courses.find((x) => x.code === code);
  if (!c) throw new Error(`fixture course ${code} missing`);
  return c;
};

function reactionAggregate(
  reacts: Partial<Record<ReactionKey, number>>,
  mine?: ReactionKey,
): ReactionAggregate {
  const counts = REACTIONS.map((r) => ({
    reaction: r,
    count: (reacts[r] ?? 0) + (mine === r ? 1 : 0),
  })).filter((r) => r.count > 0);
  return {
    totalReactions: counts.reduce((n, r) => n + r.count, 0),
    reactionsCount: counts,
    ...(mine ? { userReaction: mine } : {}),
  };
}

function canSee(post: ProtoPost, persona: PersonaKey): boolean {
  const me = PERSONAS[persona];
  if (post.by === PERSON_OF[persona]) return true;
  if (post.aud.type === 'angkatan')
    return post.aud.values.includes(me.angkatan);
  if (post.aud.type === 'group')
    return post.aud.values.some((r) => me.roles.includes(r));
  return true;
}

/** The link the prototype shows as a card becomes a URL in the post's text, as the real composer stores it. */
function postContent(post: ProtoPost): string {
  if (!post.link || post.body.includes(post.link.host)) return post.body;
  const url =
    post.link.kind === 'gform'
      ? 'https://docs.google.com/forms/d/e/e2e-gemastik-tim/viewform'
      : 'https://docs.google.com/spreadsheets/d/e2e-jadwal-uts';
  return `${post.body}\n\n${url}`;
}

function toInfo(post: ProtoPost, persona: PersonaKey): Info {
  const creator = personUser(post.by);
  const mine = post.by === PERSON_OF[persona];
  return {
    id: post.id,
    creatorId: creator.id,
    title: post.title,
    content: postContent(post),
    createdAt: post.at,
    lastNotifiedAt: post.notified,
    infoMedias: Array.from({ length: post.media ?? 0 }, (_, i) => ({
      infoId: post.id,
      mediaId: `${post.id}-media-${i}`,
      order: i,
      media: {
        id: `${post.id}-media-${i}`,
        creatorId: creator.id,
        name: `${post.id}-${i}.png`,
        type: 'image/png',
        url: mediaUrl(`${post.id}-${i}`),
        createdAt: post.at,
      },
    })),
    infoCategories: post.cats.map((id) => ({
      infoId: post.id,
      categoryId: id,
      category: categories.find((c) => c.id === id)!,
    })),
    infoCourses: [],
    infoAngkatan:
      post.aud.type === 'angkatan'
        ? post.aud.values.map((y) => ({
            infoId: post.id,
            angkatanId: `angkatan-${y}`,
            angkatan: angkatanList.find((a) => a.year === y)!,
          }))
        : [],
    infoGroups:
      post.aud.type === 'group'
        ? post.aud.values.map((r) => ({ role: r, group: ROLE_NAMES[r] }))
        : [],
    comments: post.comments.length,
    reactions: reactionAggregate(post.reacts),
    creator,
    isRead: READ0[persona].includes(post.id),
    canNotify: mine && Date.parse(NOW) - Date.parse(post.notified) > 3 * 36e5,
    isForAngkatan: post.aud.type === 'angkatan',
    isForGroups: post.aud.type === 'group',
  };
}

function toComments(post: ProtoPost): CommentWithReactions[] {
  return post.comments.map((c, i) => {
    const creator = personUser(c.by);
    return {
      id: `${post.id}-c${i + 1}`,
      repliedInfoId: post.id,
      creatorId: creator.id,
      content: c.text,
      createdAt: c.at,
      creator,
      reactions: reactionAggregate(c.reacts),
    };
  });
}

function toEvent(e: (typeof EVENTS)[number]): CalendarEvent {
  const course = e.code ? courseByCode(e.code) : null;
  return {
    id: e.id,
    calendarGroupId: course ? `group-${course.code}` : 'group-himpunan',
    courseId: course?.id ?? null,
    title: e.title,
    description: e.desc,
    category: e.cat,
    academicYear: SEMESTER.year,
    academicSemesterCode: SEMESTER.code,
    start: e.s,
    end: e.e,
    googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=e2e-${e.id}`,
    googleCalendarId: `e2e-${e.id}`,
  };
}

function toChatrooms(persona: PersonaKey): ListChatroom {
  const rooms: ListChatroom = {};
  for (const room of ROOMS[persona]) {
    const plain = (id: string) => {
      const m = room.msgs.find((x) => x.id === id)!;
      return {
        id: m.id,
        chatroomId: room.id,
        replyId: m.reply ?? null,
        content: m.text,
        createdAt: m.at,
      };
    };
    const messages: ChatroomMessage[] = [...room.msgs]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .map((m) => ({
        ...plain(m.id),
        isSender: m.me,
        ...(m.reply ? { reply: plain(m.reply) } : {}),
      }));
    const chatroom: Chatroom = {
      id: room.id,
      title: room.title,
      messages,
      labels: [],
      isPinned: false,
      canDelete: true,
    };
    rooms[room.id] = chatroom;
  }
  return rooms;
}

function toTestimonials(): Testimoni[] {
  return Object.entries(TESTI).flatMap(([code, list]) =>
    list.map((t, i) => {
      const base = {
        id: `testi-${code}-${i + 1}`,
        userId: null,
        courseId: courseByCode(code).id,
        // The prototype's "Anonim" is how the redesign shows an unnamed author; the API stores no name.
        userName: t.by === 'Anonim' ? null : t.by,
        lecturer: null,
        createdAt: wib(6, 30),
      };
      return 'overview' in t
        ? {
            ...base,
            overview: t.overview,
            assignments: t.tugas,
            lecturer_review: t.dosen,
            impressions: null,
            challenges: null,
            advice: null,
          }
        : {
            ...base,
            overview: null,
            assignments: null,
            lecturer_review: null,
            impressions: t.kesan,
            challenges: t.tantangan,
            advice: t.saran,
          };
    }),
  );
}

function toCompetitions(): Competition[] {
  return LOMBA.map((l) => ({
    id: l.id,
    name: l.name,
    organizer: l.org,
    registrationStart: l.open,
    registrationDeadline: l.close,
    price: l.price ? String(l.price) : null,
    sourceUrl: `https://example.org/e2e/${l.id}`,
    registrationUrl: `https://example.org/e2e/${l.id}/daftar`,
    categories: l.cats,
    createdAt: l.open,
    medias: [
      {
        competitionId: l.id,
        mediaId: `${l.id}-poster`,
        order: 0,
        media: {
          id: `${l.id}-poster`,
          creatorId: 'user-cnc',
          name: `${l.id}.png`,
          type: 'image/png',
          url: mediaUrl(`poster-${l.id}`),
          createdAt: l.open,
        },
      },
    ],
  }));
}

const formQuestion = (
  q: (typeof PIXEL_FORM.sections)[number]['qs'][number],
): FormQuestion => ({
  id: q.id,
  label: q.label,
  type: q.type,
  ...(q.options ? { options: q.options } : {}),
  ...(q.dependsOn
    ? { dependsOn: { questionId: q.dependsOn[0], value: q.dependsOn[1] } }
    : {}),
  ...(q.optional ? { optional: true } : {}),
});

export const pixelForm: FormDetail = {
  id: PIXEL_FORM.id,
  slug: PIXEL_FORM.slug,
  title: PIXEL_FORM.title,
  description: PIXEL_FORM.desc,
  eligibleAngkatan: PIXEL_FORM.angkatan,
  sections: PIXEL_FORM.sections.map((s) => ({
    id: s.id,
    title: s.title,
    questions: s.qs.map(formQuestion),
  })),
  opensAt: PIXEL_FORM.opensAt,
  isActive: true,
  order: 1,
  createdAt: wib(9, 1),
};

/** A form without its questions, as the list endpoints return it. */
function formSummary(form: FormDetail): Omit<FormDetail, 'sections'> {
  const summary: Partial<FormDetail> = { ...form };
  delete summary.sections;
  return summary as Omit<FormDetail, 'sections'>;
}

function formList(persona: PersonaKey, responded: boolean): FormListItem[] {
  if (!PIXEL_FORM.angkatan.includes(PERSONAS[persona].angkatan)) return [];
  const rest = formSummary(pixelForm);
  return [
    {
      ...rest,
      status: responded
        ? 'already_responded'
        : Date.parse(NOW) < Date.parse(pixelForm.opensAt)
          ? 'not_opened'
          : 'open',
    },
  ];
}

/** 142 PIXEL form responses: the prototype's latest four, then deterministic fictional members. */
function adminResponses(): AdminFormResponseItem[] {
  const firstNames = [
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
  const lastNames = [
    'Pratiwi',
    'Nugraha',
    'Saputra',
    'Wulandari',
    'Hidayat',
    'Kusuma',
    'Ramadhan',
    'Lestari',
  ];
  const out: AdminFormResponseItem[] = LIVE.latest.map(
    ([nim, fullName, major, at], i) => ({
      id: `resp-${i + 1}`,
      userId: userId(nim),
      nim,
      fullName,
      major,
      angkatan: 2025,
      answers: [{ questionId: 'q4', answer: major }],
      submittedAt: at,
    }),
  );
  let t = Date.parse(LIVE.latest[LIVE.latest.length - 1][3]);
  for (let i = out.length; i < LIVE.count; i++) {
    t -= (7 + ((i * 13) % 50)) * 60_000;
    const major = i % 3 === 0 ? 'STI' : 'IF';
    const nim = `${major === 'IF' ? '135' : '182'}25${String(110 + i).padStart(3, '0')}`;
    out.push({
      id: `resp-${i + 1}`,
      userId: userId(nim),
      nim,
      fullName: `${firstNames[i % firstNames.length]} ${lastNames[(i * 5) % lastNames.length]}`,
      major,
      angkatan: 2025,
      answers: [{ questionId: 'q4', answer: major }],
      submittedAt: new Date(t).toISOString(),
    });
  }
  return out;
}

const formAnalytics = {
  totalResponses: LIVE.count,
  questions: [
    {
      questionId: 'q4',
      label: 'Jurusan IF/STI deh?',
      type: 'radio' as const,
      options: LIVE.q4.map(([value, count]) => ({ value, count })),
    },
    {
      questionId: 'q16',
      label:
        'Kalau jalan-jalan bareng HMIF diadakan setelah libur semester, apakah kamu tertarik ikut?',
      type: 'radio' as const,
      options: LIVE.q16.map(([value, count]) => ({ value, count })),
    },
  ],
};

/** SPARTA Magang isn't in the prototype's data; these are fictional samples for the admin table (see NOTES.md). */
const internshipDepartments: InternshipDepartment[] = [
  {
    id: 'dept-akademik',
    name: 'Welfare and Academics',
    order: 1,
    divisions: [
      {
        id: 'div-akademik',
        departmentId: 'dept-akademik',
        name: 'Akademik',
        quotaMin: 2,
        quotaIdeal: 4,
        quotaMax: 6,
        questions: [
          {
            id: 'dq1',
            label: 'Kenapa kamu tertarik di Akademik?',
            type: 'textarea',
            required: true,
          },
        ],
        questionsRaw: null,
        description: 'Mengurus Testi Matkul dan rekap jadwal ujian.',
        order: 1,
      },
      {
        id: 'div-welfare',
        departmentId: 'dept-akademik',
        name: 'Welfare',
        quotaMin: 2,
        quotaIdeal: 3,
        quotaMax: 5,
        questions: [
          {
            id: 'dq2',
            label: 'Ceritakan pengalamanmu mendengarkan teman.',
            type: 'textarea',
            required: true,
          },
        ],
        questionsRaw: null,
        description: 'Menemani anggota lewat Curhat Yuk!.',
        order: 2,
      },
    ],
  },
  {
    id: 'dept-cnc',
    name: 'Competition and Community',
    order: 2,
    divisions: [
      {
        id: 'div-cnc',
        departmentId: 'dept-cnc',
        name: 'Competition and Community',
        quotaMin: 2,
        quotaIdeal: 4,
        quotaMax: 6,
        questions: [
          {
            id: 'dq3',
            label: 'Lomba apa yang pernah kamu ikuti?',
            type: 'textarea',
            required: true,
          },
        ],
        questionsRaw: null,
        description: 'Mengelola Info Lomba.',
        order: 1,
      },
    ],
  },
];
function internshipSubmissions(): InternshipSubmission[] {
  const people: PersonKey[] = ['bima', 'tasya', 'nadia'];
  return people.map((k, i) => {
    const p = PEOPLE[k];
    return {
      id: `sub-${p.nim}`,
      userId: userId(p.nim),
      nim: p.nim,
      fullName: p.name,
      jurusan: majorOf(p.nim),
      kelas: majorOf(p.nim) === 'IF' ? 'IF K2' : 'STI Ganjil',
      idLine: `e2e.${k}`,
      pengalamanOrganisasi: i === 0 ? 'Panitia SPARTA 2025' : null,
      kesibukan: [],
      isLocked: i < 2,
      submittedAt: wib(8, 20 + i, 21),
      createdAt: wib(8, 15 + i, 10),
      updatedAt: wib(8, 20 + i, 21),
      choices: ['div-akademik', 'div-welfare', 'div-cnc'].map(
        (divisionId, order) => ({
          id: `choice-${p.nim}-${order}`,
          submissionId: `sub-${p.nim}`,
          divisionId,
          priorityOrder: order + 1,
          answers: [],
        }),
      ),
    };
  });
}

const credits: Markdown = {
  id: 'credits',
  content: '# Credits\n\nPIPS! dibuat dan dirawat oleh HMIF ITB.',
  createdAt: wib(1, 1),
  updatedAt: wib(1, 1),
};

/** Everything one persona's API returns. Mutable: a test may change its own copy. */
export interface Db {
  persona: PersonaKey | null;
  /** Whether the API sees a session cookie. A test signs in or out by changing it. */
  signedIn: boolean;
  me: UserWithRoles | null;
  academic: {
    semester?: number;
    semesterYear: number;
    semesterCode: 'Ganjil' | 'Genap';
  };
  groups: UserGroups;
  angkatan: Angkatan[];
  categories: Category[];
  postableCategories: Category[];
  mutedCategoryIds: string[];
  infos: Info[];
  comments: Record<string, CommentWithReactions[]>;
  events: CalendarEvent[];
  calendarGroups: {
    id: string;
    name: string;
    category: 'akademik' | 'himpunan';
    code: string | null;
    googleCalendarUrl: string | null;
  }[];
  courses: Course[];
  myCourses: UserCourse[];
  chatrooms: ListChatroom;
  forms: FormListItem[];
  formDetails: Record<string, FormDetail>;
  myResponses: Record<string, FormResponse>;
  adminForms: Omit<FormDetail, 'sections'>[];
  adminResponses: Record<string, AdminFormResponseItem[]>;
  formAnalytics: Record<string, typeof formAnalytics>;
  competitions: Competition[];
  testimonials: Testimoni[];
  members: User[];
  internshipDepartments: InternshipDepartment[];
  internshipSubmissions: InternshipSubmission[];
  credits: Markdown;
}

/** A fresh copy of one persona's data, or of a signed-out visitor's (`null`). */
export function buildDb(persona: PersonaKey | null): Db {
  const me = persona ? personaUser(persona) : null;
  const roles = me?.roles ?? [];
  const isAdmin = roles.includes('admin');
  const myCodes = persona ? MY_COURSES[persona].map(([code]) => code) : [];
  const db: Db = {
    persona,
    signedIn: !!me,
    me,
    academic: {
      semester: persona ? PERSONAS[persona].semester : undefined,
      semesterYear: SEMESTER.year,
      semesterCode: SEMESTER.code,
    },
    groups: roles.map((r) => ({
      role: r,
      group: ROLE_NAMES[r as keyof typeof ROLE_NAMES] ?? r,
    })),
    angkatan: angkatanList,
    categories,
    postableCategories: CATEGORIES.filter(
      (c) =>
        c.roles === null ||
        c.roles.some((r) => (roles as string[]).includes(r)),
    ).map((c) => categories.find((x) => x.id === c.id)!),
    mutedCategoryIds: [],
    infos: persona
      ? POSTS.filter((p) => canSee(p, persona)).map((p) => toInfo(p, persona))
      : [],
    comments: Object.fromEntries(POSTS.map((p) => [p.id, toComments(p)])),
    events: EVENTS.filter(
      (e) => e.cat === 'himpunan' || (e.code && myCodes.includes(e.code)),
    ).map(toEvent),
    calendarGroups: [
      {
        id: 'group-himpunan',
        name: 'Himpunan',
        category: 'himpunan',
        code: null,
        googleCalendarUrl: null,
      },
      ...courses
        .filter((c) => c.major !== 'OTHER')
        .map((c) => ({
          id: `group-${c.code}`,
          name: `${c.code} ${c.name}`,
          category: 'akademik' as const,
          code: c.code,
          googleCalendarUrl: null,
        })),
    ],
    courses,
    myCourses: persona
      ? MY_COURSES[persona].map(([code, kelas]) => ({
          userId: me!.id,
          courseId: courseByCode(code).id,
          class: kelas,
          semesterCodeTaken: SEMESTER.code,
          semesterYearTaken: SEMESTER.year,
          course: courseByCode(code),
        }))
      : [],
    chatrooms: persona ? toChatrooms(persona) : {},
    forms: persona ? formList(persona, false) : [],
    formDetails: { [pixelForm.id]: pixelForm },
    myResponses: {},
    adminForms: isAdmin ? [formSummary(pixelForm)] : [],
    adminResponses: { [pixelForm.id]: adminResponses() },
    formAnalytics: { [pixelForm.id]: formAnalytics },
    competitions: toCompetitions(),
    testimonials: toTestimonials(),
    members: MEMBERS.map(([name, nim, major]) => {
      const known = (Object.keys(PEOPLE) as PersonKey[]).find(
        (k) => PEOPLE[k].nim === nim,
      );
      return known
        ? personUser(known)
        : {
            id: userId(nim),
            nim,
            email: email(nim),
            fullName: name,
            major,
            picture: avatarUrl(nim),
            region: 'Ganesha',
            angkatan: 2000 + Number(nim.slice(3, 5)),
            gender: 'F',
            membershipStatus: 'Anggota Biasa',
          };
    }),
    internshipDepartments,
    internshipSubmissions: internshipSubmissions(),
    credits,
  };
  return structuredClone(db);
}

/** Initials for generated avatars: the prototype draws initials, not photos. */
export function initialsFor(nim: string): string {
  const name =
    MEMBERS.find(([, n]) => n === nim)?.[0] ??
    Object.values(PEOPLE).find((p) => p.nim === nim)?.name ??
    LIVE.latest.find(([n]) => n === nim)?.[1] ??
    '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
