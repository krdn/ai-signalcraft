// 고객사 (customers) — 법인/조직 단위의 "고객"
// 기존 partnerClients의 진화형. 계약, 워크스페이스, 파트너 유치, 수수료 계산의 중심 엔티티
import { pgTable, text, timestamp, bigint, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { leads } from './sales';

/**
 * 고객사 (customer) — 계약된 회사/조직 단위
 * partnerClients를 흡수하여 단일 진실 원천 (Single Source of Truth)
 */
export const customers = pgTable(
  'customers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // 기본 정보
    name: text('name').notNull(), // 회사명 (표시용)
    legalName: text('legal_name'), // 법인명 (공식)
    businessNumber: text('business_number'), // 사업자등록번호
    industry: text('industry'),
    companySize: text('company_size', {
      enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'],
    }),
    website: text('website'),

    // 계약 정보
    planType: text('plan_type', {
      enum: ['starter', 'professional', 'campaign', 'enterprise'],
    }),
    status: text('status', {
      enum: ['trial', 'active', 'paused', 'churned'],
    })
      .notNull()
      .default('trial'),
    contractedAt: timestamp('contracted_at'),
    churnedAt: timestamp('churned_at'),
    // 월 매출 (원 단위, bigint로 정확한 금액 저장)
    monthlyRevenueKrw: bigint('monthly_revenue_krw', { mode: 'number' }),

    // 획득 출처 (수수료 계산 기반)
    acquisitionSource: text('acquisition_source', {
      enum: ['direct', 'channel_partner', 'referral_partner', 'organic'],
    })
      .notNull()
      .default('direct'),
    // 유치한 파트너 (users의 channel_partner or referral_partner)
    acquiredByPartnerId: text('acquired_by_partner_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // 전환된 리드 (추적용)
    acquiredFromLeadId: text('acquired_from_lead_id').references(() => leads.id, {
      onDelete: 'set null',
    }),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('customers_status_idx').on(table.status),
    index('customers_acquired_by_partner_idx').on(table.acquiredByPartnerId),
    index('customers_acquisition_source_idx').on(table.acquisitionSource),
  ],
);

/**
 * 고객사 담당자 (customer_contact) — 고객사 내의 접점 인물
 * users와 선택적으로 연결됨 (로그인 계정이 있는 경우)
 */
export const customerContacts = pgTable(
  'customer_contacts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    customerId: text('customer_id')
      .references(() => customers.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    roleTitle: text('role_title'), // "마케팅 팀장" 등
    isPrimary: boolean('is_primary').notNull().default(false),
    // 실제 로그인 계정 (선택)
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('customer_contacts_customer_idx').on(table.customerId),
    index('customer_contacts_email_idx').on(table.email),
  ],
);

/**
 * 관계 (affiliation) — 사용자와 customer/partner의 N:M 관계
 * 한 사용자가 여러 역할을 동시에 가질 수 있음
 *   - 내부 직원(staff) + 사업 파트너(channel_partner)
 *   - 고객사 오너(customer_member owner) + 추천 파트너(referral_partner)
 *
 * type에 따라 customer_id 또는 partner_contract_id 중 하나가 채워짐
 */
export const affiliations = pgTable(
  'affiliations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type', {
      enum: ['customer_member', 'channel_partner', 'referral_partner', 'sales_rep'],
    }).notNull(),

    // Polymorphic target — type에 따라 다른 테이블 참조
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    // partnerContractId는 순환 참조 피하기 위해 FK 생략 (런타임 검증)
    partnerContractId: text('partner_contract_id'),

    // 해당 관계 내 역할 (customer_member: 'owner'/'admin'/'member')
    role: text('role', { enum: ['owner', 'admin', 'member'] })
      .notNull()
      .default('member'),
    isActive: boolean('is_active').notNull().default(true),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    index('affiliations_user_idx').on(table.userId),
    index('affiliations_user_type_idx').on(table.userId, table.type),
    index('affiliations_customer_idx').on(table.customerId),
    index('affiliations_partner_contract_idx').on(table.partnerContractId),
  ],
);
