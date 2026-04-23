import { pgTable, text, timestamp, integer, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { collectionJobs } from './collections';
import { users } from './auth';

// 알림 규칙 — 사용자가 정의하는 트리거 조건 + 알림 채널
export const alertRules = pgTable(
  'alert_rules',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),

    // 트리거 조건 (JSON)
    conditions: jsonb('conditions')
      .$type<{
        sentimentShiftThreshold?: number; // 긍정/부정 비율 변화 (% 단위)
        riskScoreThreshold?: number; // risk-map 모듈 점수 임계값 (0-100)
        volumeAnomaly?: number; // 평균 대비 표준편차 배수 (예: 2)
        keywords?: string[]; // messageImpact/segmentation 결과에서 키워드 출현 시 트리거
      }>()
      .notNull(),

    // 알림 채널
    channels: jsonb('channels')
      .$type<{
        email?: boolean;
        slack?: { webhookUrl: string };
        webhook?: { url: string; headers?: Record<string, string> };
      }>()
      .notNull(),

    lastTriggeredAt: timestamp('last_triggered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('alert_rules_user_id_idx').on(table.userId),
    index('alert_rules_enabled_idx').on(table.enabled),
  ],
);

// 알림 이벤트 — 트리거된 알림 기록
export const alertEvents = pgTable(
  'alert_events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    ruleId: integer('rule_id')
      .references(() => alertRules.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: integer('job_id').references(() => collectionJobs.id, {
      onDelete: 'set null',
    }),
    triggerType: text('trigger_type').notNull(), // 'sentiment_shift' | 'risk_spike' | 'volume_anomaly' | 'keyword'
    message: text('message').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>(),
    notifiedAt: timestamp('notified_at').defaultNow().notNull(),
  },
  (table) => [
    index('alert_events_rule_id_idx').on(table.ruleId),
    index('alert_events_notified_at_idx').on(table.notifiedAt),
  ],
);
