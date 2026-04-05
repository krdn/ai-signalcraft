import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth';

// 파트너 신청
export const partnerApplications = pgTable('partner_applications', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  businessType: text('business_type', { enum: ['individual', 'corporation'] }).notNull(),
  program: text('program', { enum: ['reseller', 'partner'] }).notNull(),
  salesArea: text('sales_area'),
  introduction: text('introduction'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

// 파트너 계약
export const partnerContracts = pgTable('partner_contracts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  partnerId: text('partner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  programType: text('program_type', { enum: ['reseller', 'partner'] }).notNull(),
  commissionRate: integer('commission_rate').notNull(), // %
  responsibilities: text('responsibilities'), // 담당 업무 설명
  contractStart: timestamp('contract_start').defaultNow().notNull(),
  contractEnd: timestamp('contract_end'), // null = 무기한
  status: text('status', { enum: ['active', 'expired', 'terminated'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 파트너가 유치한 고객
export const partnerClients = pgTable('partner_clients', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  partnerId: text('partner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email'),
  clientCompany: text('client_company'),
  planType: text('plan_type', { enum: ['starter', 'professional', 'campaign'] }),
  status: text('status', { enum: ['prospect', 'negotiating', 'contracted', 'churned'] })
    .notNull()
    .default('prospect'),
  monthlyRevenue: integer('monthly_revenue'), // 만원 단위
  contractedAt: timestamp('contracted_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 수수료 추적
export const commissions = pgTable(
  'commissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    partnerId: text('partner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    clientId: text('client_id')
      .references(() => partnerClients.id, { onDelete: 'cascade' })
      .notNull(),
    periodMonth: text('period_month').notNull(), // 'YYYY-MM'
    clientRevenue: integer('client_revenue').notNull(), // 만원
    commissionRate: integer('commission_rate').notNull(), // %
    commissionAmount: integer('commission_amount').notNull(), // 만원
    status: text('status', { enum: ['pending', 'confirmed', 'paid'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('commissions_partner_client_period_idx').on(
      table.partnerId,
      table.clientId,
      table.periodMonth,
    ),
  ],
);
