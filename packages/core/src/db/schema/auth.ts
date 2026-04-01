import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';

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
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
