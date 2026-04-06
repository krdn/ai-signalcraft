import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { collectionJobs } from './collections';

// ─── 리드 관리 ───

export const leads = pgTable('leads', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 리드 정보
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  companySize: text('company_size', {
    enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
  }),
  industry: text('industry'), // 'PR에이전시', '정치캠프', '기업홍보팀' 등

  // 소스 추적
  source: text('source', {
    enum: ['cold_email', 'inbound', 'partner_referral', 'demo_signup', 'event', 'other'],
  })
    .notNull()
    .default('other'),
  sourceDetail: text('source_detail'),
  partnerId: text('partner_id').references(() => users.id, { onDelete: 'set null' }),

  // 파이프라인 상태
  stage: text('stage', {
    enum: ['lead', 'contacted', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
  })
    .notNull()
    .default('lead'),

  // 예상 거래 정보
  expectedPlan: text('expected_plan', { enum: ['starter', 'professional', 'campaign'] }),
  expectedRevenue: integer('expected_revenue'), // 만원/월
  expectedCloseDate: timestamp('expected_close_date'),

  // 리드 스코어
  score: integer('score').notNull().default(0),

  // 담당자
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),

  // 전환 추적
  demoAccountId: text('demo_account_id').references(() => users.id, { onDelete: 'set null' }),
  convertedUserId: text('converted_user_id').references(() => users.id, { onDelete: 'set null' }),

  lostReason: text('lost_reason'),
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
});

// ─── 리드 활동 로그 ───

export const leadActivities = pgTable('lead_activities', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  leadId: text('lead_id')
    .references(() => leads.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

  type: text('type', {
    enum: ['call', 'email', 'meeting', 'demo', 'proposal_sent', 'note', 'stage_change'],
  }).notNull(),

  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── 리포트 공유 링크 ───

export const reportShareLinks = pgTable('report_share_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull().unique(),

  jobId: integer('job_id')
    .references(() => collectionJobs.id, { onDelete: 'cascade' })
    .notNull(),
  createdBy: text('created_by')
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),

  // 커스터마이징
  customTitle: text('custom_title'),
  customLogo: text('custom_logo'),
  watermark: text('watermark'),

  // 접근 제어
  password: text('password'), // bcrypt 해시
  expiresAt: timestamp('expires_at'),
  maxViews: integer('max_views'),

  // 통계
  viewCount: integer('view_count').notNull().default(0),
  downloadCount: integer('download_count').notNull().default(0),
  lastViewedAt: timestamp('last_viewed_at'),

  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── 이메일 템플릿 ───

export const emailTemplates = pgTable('email_templates', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: text('name').notNull(),
  category: text('category', {
    enum: ['cold_outreach', 'follow_up', 'demo_invite', 'proposal', 'partner_intro'],
  }).notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  variables: jsonb('variables').$type<string[]>(),

  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  isDefault: boolean('is_default').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── 이메일 발송 로그 ───

export const emailSendLogs = pgTable('email_send_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  templateId: text('template_id').references(() => emailTemplates.id, { onDelete: 'set null' }),
  leadId: text('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  sentBy: text('sent_by')
    .references(() => users.id, { onDelete: 'set null' })
    .notNull(),

  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),

  status: text('status', {
    enum: ['sent', 'delivered', 'opened', 'bounced', 'failed'],
  })
    .notNull()
    .default('sent'),
  resendMessageId: text('resend_message_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
