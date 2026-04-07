import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// NextAuth AdapterAccountType 인라인 정의 (core 패키지에 next-auth 의존성 추가 방지)
type AdapterAccountType = 'oauth' | 'oidc' | 'email' | 'webauthn';

// NextAuth 필수 테이블
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  hashedPassword: text('hashed_password'), // Credentials 전용

  // --- 레거시 role (마이그레이션 중 유지, Phase 6에서 제거 예정) ---
  role: text('role', { enum: ['admin', 'leader', 'sales', 'partner', 'member', 'demo'] })
    .notNull()
    .default('member'),

  // --- 신규 2축 권한 체계 ---
  /** 시스템 전역 권한 — 'super_admin' | 'staff' | 'external' */
  systemRole: text('system_role', { enum: ['super_admin', 'staff', 'external'] })
    .notNull()
    .default('external'),
  /** 체험 사용자 플래그 (기존 role='demo' 대체) */
  isTrial: boolean('is_trial').notNull().default(false),
  /** 체험 만료일 */
  trialExpiresAt: timestamp('trial_expires_at'),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    uniqueIndex('accounts_provider_pk').on(account.provider, account.providerAccountId),
  ],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [uniqueIndex('verification_tokens_pk').on(vt.identifier, vt.token)],
);

// 팀 기능 테이블
export const teams = pgTable('teams', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  createdBy: text('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teamMembers = pgTable(
  'team_members',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role', { enum: ['admin', 'member'] })
      .notNull()
      .default('member'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId)],
);

export const invitations = pgTable('invitations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id')
    .references(() => teams.id, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 데모 사용자 쿼터 관리
export const demoQuotas = pgTable('demo_quotas', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  dailyLimit: integer('daily_limit').notNull().default(5), // 1일 최대 분석 횟수
  todayUsed: integer('today_used').notNull().default(0), // 오늘 사용한 횟수
  todayDate: text('today_date'), // 오늘 날짜 (YYYY-MM-DD) — 날짜 바뀌면 todayUsed 리셋
  totalUsed: integer('total_used').notNull().default(0), // 누적 사용 횟수
  allowedModules: jsonb('allowed_modules').$type<string[]>(),
  maxCollectionLimits: jsonb('max_collection_limits').$type<{
    naverArticles: number;
    youtubeVideos: number;
    communityPosts: number;
    commentsPerItem: number;
  }>(),
  expiresAt: timestamp('expires_at').notNull(), // 가입 후 7일
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
