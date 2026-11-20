import { init } from '@paralleldrive/cuid2';
import { type InferSelectModel, relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type webpush from 'web-push';
import type {
  CollaboratorRole,
  EmergencyRelation,
  FormAnswer,
  FormQuestion,
  FormSection,
  ProfileField,
} from '../lib/form-model';
import { rolesEnums } from './roles-group';

export const createId = init({
  length: 8,
});

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    nim: text('nim').unique().notNull(),
    email: text('email').unique().notNull(),
    fullName: text('full_name').notNull(),
    major: text('jurusan', { enum: ['IF', 'STI'] }).notNull(),
    picture: text('picture'),
    region: text('asal_kampus', {
      enum: ['Ganesha', 'Jatinangor'],
    }).notNull(),
    angkatan: integer('angkatan')
      .references(() => angkatan.year, { onDelete: 'cascade' })
      .notNull(),
    gender: text('jenis_kelamin', { enum: ['F', 'M'] }).notNull(),
    membershipStatus: text('status_keanggotaan').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    nimIdx: index().on(t.nim),
    emailIdx: index().on(t.email),
  }),
);

export type User = InferSelectModel<typeof users>;

export const usersRelation = relations(users, ({ many, one }) => ({
  pushSubscriptions: many(pushSubscriptions),
  infos: many(infos),
  medias: many(medias),
  userReadInfos: many(userReadInfos),
  comments: many(comments),
  reactions: many(reactions),
  angkatan: one(angkatan, {
    fields: [users.angkatan],
    references: [angkatan.year],
  }),
  userCourses: many(userCourses),
  userUnsubscribeCategories: many(userUnsubscribeCategories),
  testimonies: many(testimonies),
  userRoles: many(userRoles),
  voucherRecommendations: many(voucherRecommendations),
  chatrooms: many(chatrooms),
  chatroomMessages: many(chatroomMessages),
  pinnedChatrooms: many(userPinnedChatrooms),
  chatroomMessageReads: many(chatroomMessageReads),
  coWorkingSpaceRecommendations: many(coWorkingSpaceRecommendations),
}));

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    keys: json('keys').$type<webpush.PushSubscription['keys']>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index().on(t.userId),
  }),
);

export type PushSubscription = InferSelectModel<typeof pushSubscriptions>;

export const pushSubscriptionsRelation = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const googleSubscriptions = pgTable('google_subscriptions', {
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  idToken: text('id_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  scope: text('scope').notNull(),
  expiresIn: integer('expires_in').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GoogleSubscription = InferSelectModel<typeof googleSubscriptions>;

export const googleSubscriptionsRelation = relations(
  googleSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [googleSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const infos = pgTable(
  'infos',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    creatorId: text('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    isForAngkatan: boolean('is_for_angkatan').notNull(), // redundancy for angkatan relation
    isForGroups: boolean('is_for_groups').notNull(), // redundancy for group relation
    lastNotifiedAt: timestamp('last_notified_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    contentSearchIdx: index('content_search_idx').using(
      'gin',
      sql`(
        setweight(to_tsvector('indonesian', ${t.title}), 'A') ||
        setweight(to_tsvector('indonesian', ${t.content}), 'B')
      )`,
    ),
  }),
);

export type Info = InferSelectModel<typeof infos>;

export const infosRelation = relations(infos, ({ one, many }) => ({
  creator: one(users, {
    fields: [infos.creatorId],
    references: [users.id],
  }),
  userReadInfos: many(userReadInfos),
  infoMedias: many(infoMedias),
  comments: many(comments),
  reactions: many(reactions),
  infoCategories: many(infoCategories),
  infoCourses: many(infoCourses),
  infoAngkatan: many(infoAngkatan),
  infoGroups: many(infoGroups),
}));

export const infoGroups = pgTable(
  'info_groups',
  {
    infoId: text('info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').$type<UserRolesEnum>().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.infoId, t.role] }),
  }),
);

export const infoGroupsRelation = relations(infoGroups, ({ one }) => ({
  info: one(infos, {
    fields: [infoGroups.infoId],
    references: [infos.id],
  }),
}));

export const medias = pgTable('medias', {
  id: text('id').primaryKey().$defaultFn(createId),
  creatorId: text('creator_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').unique().notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Media = InferSelectModel<typeof medias>;

export const mediasRelation = relations(medias, ({ one, many }) => ({
  creator: one(users, {
    fields: [medias.creatorId],
    references: [users.id],
  }),
  infoMedias: many(infoMedias),
  competitions: many(competitionMedias),
}));

export const userReadInfos = pgTable(
  'user_read_infos',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    infoId: text('info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.infoId] }),
  }),
);

export const userReadInfosRelation = relations(userReadInfos, ({ one }) => ({
  user: one(users, {
    fields: [userReadInfos.userId],
    references: [users.id],
  }),
  info: one(infos, {
    fields: [userReadInfos.infoId],
    references: [infos.id],
  }),
}));

export const infoMedias = pgTable(
  'info_medias',
  {
    infoId: text('info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    mediaId: text('media_id')
      .references(() => medias.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.infoId, t.mediaId] }) }),
);

export const infoMediasRelation = relations(infoMedias, ({ one }) => ({
  info: one(infos, {
    fields: [infoMedias.infoId],
    references: [infos.id],
  }),
  media: one(medias, {
    fields: [infoMedias.mediaId],
    references: [medias.id],
  }),
}));

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    repliedInfoId: text('replied_info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    creatorId: text('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    repliedInfoIdIdx: index().on(t.repliedInfoId),
    creatorIdIdx: index().on(t.creatorId),
  }),
);

export type Comment = InferSelectModel<typeof comments>;

export const commentsRelation = relations(comments, ({ one, many }) => ({
  creator: one(users, {
    fields: [comments.creatorId],
    references: [users.id],
  }),
  repliedInfo: one(infos, {
    fields: [comments.repliedInfoId],
    references: [infos.id],
  }),
  reactions: many(reactions),
}));

export const reactions = pgTable(
  'reactions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    creatorId: text('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    infoId: text('info_id').references(() => infos.id, { onDelete: 'cascade' }),
    commentId: text('comment_id').references(() => comments.id, {
      onDelete: 'cascade',
    }),
    reaction: text('reaction').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    infoIdIdx: index().on(t.infoId),
    commentIdIdx: index().on(t.commentId),
    uniqueIdentifier: unique()
      .on(t.creatorId, t.infoId, t.commentId)
      .nullsNotDistinct(),
  }),
);

export type Reaction = InferSelectModel<typeof reactions>;

export const reactionsRelation = relations(reactions, ({ one }) => ({
  creator: one(users, {
    fields: [reactions.creatorId],
    references: [users.id],
  }),
  info: one(infos, {
    fields: [reactions.infoId],
    references: [infos.id],
  }),
  comment: one(comments, {
    fields: [reactions.commentId],
    references: [comments.id],
  }),
}));

export const courses = pgTable(
  'courses',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    curriculumYear: integer('curriculum_year').notNull(),
    major: text('jurusan', { enum: ['IF', 'STI', 'OTHER'] }).notNull(),
    type: text('type', { enum: ['Mandatory', 'Elective'] })
      .default('Elective')
      .notNull(),
    semester: integer('semester'),
    semesterCode: text('semester_code', {
      enum: ['Ganjil', 'Genap'],
    }),
    code: text('code').unique().notNull(),
    name: text('name').notNull(),
    credits: integer('sks'),
    dingdongUrl: text('dingdong_url'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    codeIdx: index().on(t.code),
    searchIdx: index('search_idx').using(
      'gin',
      sql`(
        setweight(to_tsvector('indonesian', ${t.name}), 'A') ||
        setweight(to_tsvector('indonesian', ${t.code}), 'B')
      )`,
    ),
  }),
);

export type Course = InferSelectModel<typeof courses>;

export const coursesRelation = relations(courses, ({ many }) => ({
  infoCourses: many(infoCourses),
  userCourses: many(userCourses),
  testimonies: many(testimonies),
  calendarEvent: many(calendarEvent),
}));

export const categories = pgTable('categories', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').unique().notNull(),
  rolesAllowed: json('roles_allowed').$type<UserRolesEnum[]>(),
  requiredPush: boolean('required_push').notNull(),
  isForInfo: boolean('is_for_info').notNull(),
});

export type Category = InferSelectModel<typeof categories>;

export const categoriesRelation = relations(categories, ({ many }) => ({
  infoCategories: many(infoCategories),
  userUnsubscribeCategories: many(userUnsubscribeCategories),
}));

export const angkatan = pgTable('angkatan', {
  id: text('id').primaryKey().$defaultFn(createId),
  year: integer('year').unique().notNull(),
  name: text('name').unique().notNull(),
});

export type Angkatan = InferSelectModel<typeof angkatan>;

export const angkatanRelation = relations(angkatan, ({ many }) => ({
  users: many(users),
  infoAngkatan: many(infoAngkatan),
}));

export const infoCourses = pgTable(
  'info_courses',
  {
    infoId: text('info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    courseId: text('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    class: integer('class'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.infoId, t.courseId] }) }),
);

export const infoCoursesRelation = relations(infoCourses, ({ one }) => ({
  info: one(infos, { fields: [infoCourses.infoId], references: [infos.id] }),
  course: one(courses, {
    fields: [infoCourses.courseId],
    references: [courses.id],
  }),
}));

export const infoAngkatan = pgTable(
  'info_angkatan',
  {
    infoId: text('info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    angkatanId: text('angkatan_id')
      .references(() => angkatan.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.infoId, t.angkatanId] }) }),
);

export const infoAngkatanRelation = relations(infoAngkatan, ({ one }) => ({
  info: one(infos, { fields: [infoAngkatan.infoId], references: [infos.id] }),
  angkatan: one(angkatan, {
    fields: [infoAngkatan.angkatanId],
    references: [angkatan.id],
  }),
}));

export const infoCategories = pgTable(
  'info_categories',
  {
    infoId: text('info_id')
      .references(() => infos.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: text('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.infoId, t.categoryId] }) }),
);

export const infoCategoriesRelation = relations(infoCategories, ({ one }) => ({
  info: one(infos, {
    fields: [infoCategories.infoId],
    references: [infos.id],
  }),
  category: one(categories, {
    fields: [infoCategories.categoryId],
    references: [categories.id],
  }),
}));

export const userCourses = pgTable(
  'user_courses',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    courseId: text('course_id')
      .references(() => courses.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    class: integer('class').notNull(),
    semesterCodeTaken: text('semester_code_taken', {
      enum: ['Ganjil', 'Genap'],
    }).notNull(),
    semesterYearTaken: integer('semester_year_taken').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.courseId] }) }),
);

export const userCoursesRelation = relations(userCourses, ({ one }) => ({
  user: one(users, { fields: [userCourses.userId], references: [users.id] }),
  course: one(courses, {
    fields: [userCourses.courseId],
    references: [courses.id],
  }),
}));

export const userUnsubscribeCategories = pgTable(
  'user_unsubscribe_categories',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: text('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.categoryId] }) }),
);

export const userUnsubscribeCategoriesRelation = relations(
  userUnsubscribeCategories,
  ({ one }) => ({
    user: one(users, {
      fields: [userUnsubscribeCategories.userId],
      references: [users.id],
    }),
    category: one(categories, {
      fields: [userUnsubscribeCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const testimonies = pgTable(
  'testimonies',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id, {
        onDelete: 'cascade',
      }),
    userName: text('user_name'),
    // STI Testimonies
    impressions: text('impressions'),
    challenges: text('challenges'),
    advice: text('advice'),

    // IF Testimonies
    overview: text('overview'),
    assignments: text('assignments'),
    lecturer_review: text('lecturer_review'),

    lecturer: text('lecturer'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index().on(t.userId),
    courseIdIdx: index().on(t.courseId),
  }),
);

export const testimoniesRelation = relations(testimonies, ({ one }) => ({
  user: one(users, { fields: [testimonies.userId], references: [users.id] }),
  course: one(courses, {
    fields: [testimonies.courseId],
    references: [courses.id],
  }),
}));

export const calendarGroup = pgTable('calendar_group', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull(),
  category: text('category', { enum: ['akademik', 'himpunan'] }).notNull(),
  code: text('code'),
  googleCalendarUrl: text('google_calendar_url'),
  // Kalender copies this Google calendar's events (cron/calendar-sync.ts); the app never adds to it.
  synced: boolean('synced').notNull().default(false),
});

export type CalendarGroup = InferSelectModel<typeof calendarGroup>;

export const calendarGroupRelation = relations(calendarGroup, ({ many }) => ({
  calendarEvent: many(calendarEvent),
}));

export const calendarEvent = pgTable(
  'calendar_event',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    calendarGroupId: text('calendar_group_id')
      .notNull()
      .references(() => calendarGroup.id, { onDelete: 'cascade' }),
    courseId: text('courses_id').references(() => courses.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    academicYear: integer('academic_year'),
    academicSemesterCode: text('academic_semester_code', {
      enum: ['Ganjil', 'Genap'],
    }),
    start: timestamp('start', { withTimezone: true }).notNull(),
    end: timestamp('end', { withTimezone: true }).notNull(),
    googleCalendarUrl: text('google_calendar_url').notNull(),
    googleCalendarId: text('google_calendar_id').notNull(),
    // A copy of an event in a synced Google calendar: changed there, never in the app.
    synced: boolean('synced').notNull().default(false),
    // From midnight to midnight in WIB, for as many days as it spans (Google's all-day events).
    allDay: boolean('all_day').notNull().default(false),
    location: text('location'),
  },
  (t) => ({
    titleSearchIdx: index('title_search_idx').using(
      'gin',
      sql`(
        setweight(to_tsvector('indonesian', ${t.title}), 'A') ||
        setweight(to_tsvector('indonesian', ${t.description}), 'B')
      )`,
    ),
  }),
);

export type CalendarEvent = InferSelectModel<typeof calendarEvent>;

export const calendarEventRelations = relations(calendarEvent, ({ one }) => ({
  calendarGroup: one(calendarGroup, {
    fields: [calendarEvent.calendarGroupId],
    references: [calendarGroup.id],
  }),
  course: one(courses, {
    fields: [calendarEvent.courseId],
    references: [courses.id],
  }),
}));

export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role', { enum: rolesEnums }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.role] }) }),
);

export type UserRolesEnum = (typeof rolesEnums)[number];

export const userRolesRelation = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
}));

export const competitionCategories = [
  'Competitive Programming',
  'Capture The Flag',
  'Data Science / Data Analytics',
  'UI/UX',
  'Game Development',
  'Business IT Case',
  'Innovation',
  'Web Development',
] as const;

export type CompetitionCategory = (typeof competitionCategories)[number];

export const competitions = pgTable('competitions', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull(),
  organizer: text('organizer').notNull(),
  registrationStart: timestamp('registration_start_date', {
    withTimezone: true,
  }),
  registrationDeadline: timestamp('registration_deadline_date', {
    withTimezone: true,
  }),
  price: text('price'),
  sourceUrl: text('source_url').notNull(),
  registrationUrl: text('registration_url').notNull(),
  categories: json('categories')
    .$type<CompetitionCategory[]>()
    .default([])
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const competitionsRelation = relations(competitions, ({ many }) => ({
  medias: many(competitionMedias),
}));

export const competitionMedias = pgTable(
  'competition_medias',
  {
    competitionId: text('competition_id')
      .references(() => competitions.id, { onDelete: 'cascade' })
      .notNull(),
    mediaId: text('media_id')
      .references(() => medias.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.competitionId, t.mediaId] }) }),
);

export const competitionMediasRelation = relations(
  competitionMedias,
  ({ one }) => ({
    competition: one(competitions, {
      fields: [competitionMedias.competitionId],
      references: [competitions.id],
    }),
    media: one(medias, {
      fields: [competitionMedias.mediaId],
      references: [medias.id],
    }),
  }),
);

export const markdowns = pgTable('markdowns', {
  id: text('id').primaryKey().$defaultFn(createId),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const chatrooms = pgTable('chatrooms', {
  id: text('id').primaryKey().$defaultFn(createId),
  title: text('title'),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
});

export type Chatroom = InferSelectModel<typeof chatrooms>;

export const chatroomsRelation = relations(chatrooms, ({ many, one }) => ({
  user: one(users, {
    fields: [chatrooms.userId],
    references: [users.id],
  }),
  messages: many(chatroomMessages),
  pinnedBy: many(userPinnedChatrooms),
  labels: many(chatroomLabelsManyToMany),
}));

export const chatroomMessages = pgTable(
  'chatroom_messages',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    chatroomId: text('chatroom_id')
      .references(() => chatrooms.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    replyId: text('reply_id').references(
      (): AnyPgColumn => chatroomMessages.id,
      {
        onDelete: 'cascade',
      },
    ),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    /**
     * The id the sender's device gave the message (a UUID), so a resend after a lost acknowledgement is matched to the
     * saved message instead of saved twice. Null for messages from older clients.
     */
    clientMessageId: text('client_message_id'),
  },
  (t) => ({
    clientMessageIdx: uniqueIndex('chatroom_messages_client_message_idx').on(
      t.chatroomId,
      t.clientMessageId,
    ),
  }),
);

export type ChatroomMessage = InferSelectModel<typeof chatroomMessages>;

export const chatroomMessagesRelation = relations(
  chatroomMessages,
  ({ one, many }) => ({
    reply: one(chatroomMessages, {
      fields: [chatroomMessages.replyId],
      references: [chatroomMessages.id],
    }),
    chatroom: one(chatrooms, {
      fields: [chatroomMessages.chatroomId],
      references: [chatrooms.id],
    }),
    sender: one(users, {
      fields: [chatroomMessages.userId],
      references: [users.id],
    }),
    chatroomMessageReads: many(chatroomMessageReads),
  }),
);

export const userPinnedChatrooms = pgTable(
  'user_pinned_chatrooms',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    chatroomId: text('chatroom_id')
      .references(() => chatrooms.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.chatroomId] }) }),
);

export type UserPinnedChatrooms = InferSelectModel<typeof userPinnedChatrooms>;

export const userPinnedChatroomsRelation = relations(
  userPinnedChatrooms,
  ({ one }) => ({
    user: one(users, {
      fields: [userPinnedChatrooms.userId],
      references: [users.id],
    }),
    chatroom: one(chatrooms, {
      fields: [userPinnedChatrooms.chatroomId],
      references: [chatrooms.id],
    }),
  }),
);

export const chatroomLabels = pgTable('chatroom_labels', {
  id: text('id').primaryKey().$defaultFn(createId),
  title: text('name').notNull(),
});

export const chatroomLabelsRelation = relations(chatroomLabels, ({ many }) => ({
  chatrooms: many(chatroomLabelsManyToMany),
}));

export const chatroomLabelsManyToMany = pgTable(
  'chatroom_labels_many_to_many',
  {
    chatroomId: text('chatroom_id')
      .references(() => chatrooms.id, { onDelete: 'cascade' })
      .notNull(),
    labelId: text('label_id')
      .references(() => chatroomLabels.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.chatroomId, t.labelId] }) }),
);

export const chatroomLabelsManyToManyRelation = relations(
  chatroomLabelsManyToMany,
  ({ one }) => ({
    chatroom: one(chatrooms, {
      fields: [chatroomLabelsManyToMany.chatroomId],
      references: [chatrooms.id],
    }),
    label: one(chatroomLabels, {
      fields: [chatroomLabelsManyToMany.labelId],
      references: [chatroomLabels.id],
    }),
  }),
);

export const chatroomMessageReads = pgTable(
  'chatroom_message_reads',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    chatroomMessageId: text('chatroom_message_id')
      .references(() => chatroomMessages.id, { onDelete: 'cascade' })
      .notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.chatroomMessageId] }) }),
);

export const chatroomMessageReadsRelation = relations(
  chatroomMessageReads,
  ({ one }) => ({
    user: one(users, {
      fields: [chatroomMessageReads.userId],
      references: [users.id],
    }),
    message: one(chatroomMessages, {
      fields: [chatroomMessageReads.chatroomMessageId],
      references: [chatroomMessages.id],
    }),
  }),
);

export const voucherRecommendations = pgTable('voucher_recommendations', {
  id: text('id').primaryKey().$defaultFn(createId),
  title: text('title').notNull(),
  imageURL: text('image_url').notNull(),
  link: text('link'),
  startPeriod: timestamp('start_period', { withTimezone: true }),
  endPeriod: timestamp('end_period', { withTimezone: true }),
  description: text('description'),
  creatorId: text('creator_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
});

export const voucherRecommendationsRelation = relations(
  voucherRecommendations,
  ({ one }) => ({
    creator: one(users, {
      fields: [voucherRecommendations.creatorId],
      references: [users.id],
    }),
  }),
);

export const coWorkingSpaceRecommendations = pgTable(
  'co_working_space_recommendations',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    title: text('title').notNull(),
    imageURL: text('image_url').notNull(),
    location: text('location', { enum: ['Ganesha', 'Jatinangor'] }).notNull(),
    address: text('address').notNull(),
    mapsURL: text('maps_url').notNull(),
    description: text('description'),
    creatorId: text('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
);

export const coWorkingSpaceRecommendationsRelation = relations(
  coWorkingSpaceRecommendations,
  ({ one }) => ({
    creator: one(users, {
      fields: [coWorkingSpaceRecommendations.creatorId],
      references: [users.id],
    }),
  }),
);

export const voucherReviews = pgTable(
  'voucher_reviews',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    voucherId: text('voucher_id')
      .references(() => voucherRecommendations.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating').notNull(),
    review: text('review').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.voucherId, t.userId] }) }),
);

export const coWorkingSpaceReviews = pgTable(
  'co_working_space_reviews',
  {
    coWorkingSpaceId: text('coWorkingSpace_id')
      .references(() => coWorkingSpaceRecommendations.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating').notNull(),
    review: text('review').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.coWorkingSpaceId, t.userId] }) }),
);

export const voucherReviewsRelation = relations(voucherReviews, ({ one }) => ({
  recommendation: one(voucherRecommendations, {
    fields: [voucherReviews.voucherId],
    references: [voucherRecommendations.id],
  }),
  user: one(users, {
    fields: [voucherReviews.userId],
    references: [users.id],
  }),
}));

export const coWorkingSpaceReviewsRelation = relations(
  coWorkingSpaceReviews,
  ({ one }) => ({
    recommendation: one(coWorkingSpaceRecommendations, {
      fields: [coWorkingSpaceReviews.coWorkingSpaceId],
      references: [coWorkingSpaceRecommendations.id],
    }),
    user: one(users, {
      fields: [coWorkingSpaceReviews.userId],
      references: [users.id],
    }),
  }),
);

export interface InternshipQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  options?: string[];
  required: boolean;
}

export interface InternshipKesibukan {
  jabatan: string;
  organisasi: string;
  periode: string;
}

export interface InternshipAnswer {
  questionId: string;
  answer: string;
}

export const internshipDepartments = pgTable('internship_departments', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull().unique(),
  order: integer('order').notNull().default(0),
});

export const internshipDepartmentsRelation = relations(
  internshipDepartments,
  ({ many }) => ({
    divisions: many(internshipDivisions),
  }),
);

export const internshipDivisions = pgTable('internship_divisions', {
  id: text('id').primaryKey().$defaultFn(createId),
  departmentId: text('department_id')
    .notNull()
    .references(() => internshipDepartments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quotaMin: integer('quota_min'),
  quotaIdeal: integer('quota_ideal'),
  quotaMax: integer('quota_max'),
  questions: json('questions')
    .$type<InternshipQuestion[]>()
    .notNull()
    .default([]),
  questionsRaw: text('questions_raw'),
  description: text('description'),
  order: integer('order').notNull().default(0),
});

export const internshipDivisionsRelation = relations(
  internshipDivisions,
  ({ one, many }) => ({
    department: one(internshipDepartments, {
      fields: [internshipDivisions.departmentId],
      references: [internshipDepartments.id],
    }),
    choices: many(internshipSubmissionChoices),
  }),
);

export const internshipSubmissions = pgTable('internship_submissions', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  nim: text('nim').notNull(),
  fullName: text('full_name').notNull(),
  jurusan: text('jurusan').notNull(),
  kelas: text('kelas').notNull(),
  idLine: text('id_line').notNull(),
  pengalamanOrganisasi: text('pengalaman_organisasi'),
  kesibukan: json('kesibukan')
    .$type<InternshipKesibukan[]>()
    .notNull()
    .default([]),
  isLocked: boolean('is_locked').notNull().default(false),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const internshipSubmissionsRelation = relations(
  internshipSubmissions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [internshipSubmissions.userId],
      references: [users.id],
    }),
    choices: many(internshipSubmissionChoices),
  }),
);

export const internshipSubmissionChoices = pgTable(
  'internship_submission_choices',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    submissionId: text('submission_id')
      .notNull()
      .references(() => internshipSubmissions.id, { onDelete: 'cascade' }),
    divisionId: text('division_id')
      .notNull()
      .references(() => internshipDivisions.id, { onDelete: 'cascade' }),
    priorityOrder: integer('priority_order').notNull(),
    answers: json('answers').$type<InternshipAnswer[]>().notNull().default([]),
  },
  (t) => ({
    uniqSubmissionDivision: unique().on(t.submissionId, t.divisionId),
    uniqSubmissionPriority: unique().on(t.submissionId, t.priorityOrder),
  }),
);

export const internshipSubmissionChoicesRelation = relations(
  internshipSubmissionChoices,
  ({ one }) => ({
    submission: one(internshipSubmissions, {
      fields: [internshipSubmissionChoices.submissionId],
      references: [internshipSubmissions.id],
    }),
    division: one(internshipDivisions, {
      fields: [internshipSubmissionChoices.divisionId],
      references: [internshipDivisions.id],
    }),
  }),
);

// The JSON inside `forms.sections` and `form_responses.answers` is described in lib/form-model.ts, shared with tests.
export type { FormAnswer, FormQuestion, FormSection };

export const forms = pgTable('forms', {
  id: text('id').primaryKey().$defaultFn(createId),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  eligibleAngkatan: json('eligible_angkatan')
    .$type<number[]>()
    .notNull()
    .default([]),
  sections: json('sections').$type<FormSection[]>().notNull().default([]),
  // Null only on a draft whose maker chose no opening time: publishing sets it to that moment.
  opensAt: timestamp('opens_at', { withTimezone: true }),
  // When answers stop being accepted; null keeps the form open until it's switched off (isActive).
  closesAt: timestamp('closes_at', { withTimezone: true }),
  // False on a draft too, so an app from before drafts (it lists every active form) never shows one.
  isActive: boolean('is_active').notNull().default(true),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // The pengurus who made it; null for forms made before the builder, which only admin manages.
  ownerId: text('owner_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  // Null while a draft.
  publishedAt: timestamp('published_at', { withTimezone: true }),
  // What goes along from the member's profile, as they agree at the end of the form.
  requestedFields: json('requested_fields')
    .$type<ProfileField[]>()
    .notNull()
    .default([]),
  // A member may change what they sent until the form closes.
  allowEdit: boolean('allow_edit').notNull().default(false),
  // The sent screen's words; null shows the app's own.
  thanks: text('thanks'),
  // True once someone chose the short name; until then a draft's name follows its title.
  slugCustom: boolean('slug_custom').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Form = InferSelectModel<typeof forms>;

/**
 * Seasonal programmes and campaigns the app points members to while they're open. Open while is_active, from
 * opens_at until closes_at (null: until switched off); for everyone when both eligibility lists are empty,
 * otherwise a listed angkatan or NIM.
 */
export const programmeWindows = pgTable('programme_windows', {
  id: text('id').primaryKey().$defaultFn(createId),
  slug: text('slug').unique().notNull(),
  kind: text('kind', { enum: ['programme', 'campaign'] }).notNull(),
  label: text('label').notNull(),
  // An app path ("/layanan/sparta") or an https:// address; anything else is never served.
  route: text('route').notNull(),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  eligibleAngkatan: json('eligible_angkatan')
    .$type<number[]>()
    .notNull()
    .default([]),
  eligibleNims: json('eligible_nims').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProgrammeWindow = InferSelectModel<typeof programmeWindows>;

export const formsRelation = relations(forms, ({ many, one }) => ({
  responses: many(formResponses),
  collaborators: many(formCollaborators),
  owner: one(users, { fields: [forms.ownerId], references: [users.id] }),
}));

/** Pengurus a form is shared with (Bagikan): `view` sees it and its answers, `edit` also changes and shares it. */
export const formCollaborators = pgTable(
  'form_collaborators',
  {
    formId: text('form_id')
      .references(() => forms.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role', { enum: ['view', 'edit'] })
      .$type<CollaboratorRole>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.formId, t.userId] }),
    userIdx: index().on(t.userId),
  }),
);

export const formCollaboratorsRelation = relations(
  formCollaborators,
  ({ one }) => ({
    form: one(forms, {
      fields: [formCollaborators.formId],
      references: [forms.id],
    }),
    user: one(users, {
      fields: [formCollaborators.userId],
      references: [users.id],
    }),
  }),
);

/**
 * A member's saved details (Profil › Data diri): given once, requested by forms, sent only after the member agrees.
 * One row per member; a null column is a detail never given. Account facts stay in `users`.
 */
export const memberDetails = pgTable('member_details', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  whatsapp: text('whatsapp'),
  line: text('line'),
  instagram: text('instagram'),
  address: text('address'),
  hometown: text('hometown'),
  emergencyName: text('emergency_name'),
  emergencyRelation: text('emergency_relation').$type<EmergencyRelation>(),
  emergencyPhone: text('emergency_phone'),
  health: text('health'),
  birthDate: date('birth_date', { mode: 'string' }),
  studentCardPhoto: text('student_card_photo'),
  photo: text('photo'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const formResponses = pgTable(
  'form_responses',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    formId: text('form_id')
      .references(() => forms.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    answers: json('answers').$type<FormAnswer[]>().notNull(),
    // The requested profile fields as they were sent, by field: what the member saw and agreed to.
    profile: json('profile')
      .$type<Partial<Record<ProfileField, string>>>()
      .notNull()
      .default({}),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // When the member last changed it ("Ubah jawaban"); null if never.
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => ({
    uniqueUserForm: unique().on(t.formId, t.userId),
  }),
);

export type FormResponse = InferSelectModel<typeof formResponses>;

export const formResponsesRelation = relations(formResponses, ({ one }) => ({
  form: one(forms, {
    fields: [formResponses.formId],
    references: [forms.id],
  }),
  user: one(users, {
    fields: [formResponses.userId],
    references: [users.id],
  }),
}));

/**
 * Apps a member connects through MCP (docs/adr/0021-*): OAuth 2.1 public clients that registered themselves
 * (RFC 7591). The id is not a secret; a public client has none.
 */
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(),
  // As the client named itself, cleaned (lib/oauth.ts): shown on the consent page as plain text only.
  name: text('name').notNull(),
  redirectUris: json('redirect_uris').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One sign-in of an app: the request the consent page shows, then the code it turns into. Single use. Only hashes of
 * the request id and the code are kept, never the values.
 */
export const oauthAuthorizations = pgTable(
  'oauth_authorizations',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    requestHash: text('request_hash').notNull().unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    redirectUri: text('redirect_uri').notNull(),
    scope: text('scope').notNull(),
    // The client's own value, returned to it unchanged.
    state: text('state'),
    codeChallenge: text('code_challenge').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    deniedAt: timestamp('denied_at', { withTimezone: true }),
    codeHash: text('code_hash').unique(),
    codeExpiresAt: timestamp('code_expires_at', { withTimezone: true }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    // The tokens the code was exchanged for, so a second use of the code revokes them.
    tokenFamily: text('token_family'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    expiresAtIdx: index().on(t.expiresAt),
  }),
);

/**
 * An app's access to a member. Each refresh writes a new row in the same family and retires the old one; a retired
 * refresh token used again revokes the family. Only hashes are kept.
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    family: text('family').notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    accessHash: text('access_hash').notNull().unique(),
    accessExpiresAt: timestamp('access_expires_at', {
      withTimezone: true,
    }).notNull(),
    refreshHash: text('refresh_hash').notNull().unique(),
    refreshExpiresAt: timestamp('refresh_expires_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    userClientIdx: index().on(t.userId, t.clientId),
    familyIdx: index().on(t.family),
  }),
);

export type OAuthClient = InferSelectModel<typeof oauthClients>;
export type OAuthAuthorization = InferSelectModel<typeof oauthAuthorizations>;
export type OAuthToken = InferSelectModel<typeof oauthTokens>;
