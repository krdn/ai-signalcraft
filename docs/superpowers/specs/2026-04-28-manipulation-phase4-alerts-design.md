# Manipulation Alerts 설계 (Phase 4 — 알림)

> **Phase 3 후속.** Phase 3 (대시보드 + 시계열) 완료. 이 스펙은 manipulation 분석 결과의 점수가 임계값을 초과할 때 Slack/webhook으로 자동 통보하는 기능을 추가한다.

**날짜**: 2026-04-28
**관련 커밋**: `e551b27` (Phase 3 showcase 8번째 탭), `b71cb65` (구독 토글)
**관련 spec**: [Phase 3 대시보드](2026-04-28-manipulation-dashboard-design.md)
**E2E 검증된 데이터 (Phase 2 dryrun)**: jobId=273, subscriptionId=37, runId=`25bc0a41-c398-4022-93b8-e9790a0914a9`, manipulationScore=57.21, confidence=0.84

## 목표

manipulation 분석 결과를 사용자가 능동적으로 확인하지 않아도 Slack/webhook으로 자동 통보한다.

1. 구독별 알림 규칙 CRUD
2. manipulation pipeline 완료 직후 임계값 평가 및 발화
3. 쿨다운 기반 중복 발화 방지

## 비목표 (YAGNI)

- 이메일 알림 — Resend 통합 등 운영 의사결정이 별도 필요. 다음 작업
- 점수 외 트리거 (신뢰도, spike, 신호별 임계값) — 운영 데이터 누적 후 정교화
- 발화 이력 페이지 / `alert_events` 통합 — 기존 alerts 인프라가 사실상 미사용 상태이며, 이 spec scope를 넘어섬
- 재시도 큐 / `deliveryStatus` 트래킹 — 다음 run에서 재평가되므로 6시간 cooldown 안에서 자연 재시도
- 필터/검색·CSV 익스포트 — Phase 4의 별도 spec으로 분리

## 아키텍처

```
[manipulation pipeline worker — stage5.ts]
  ↓ persistRun → runId 반환
  ↓ void evaluateManipulationAlerts({ runId, jobId, subscriptionId })  ─ fire-and-forget
[packages/core/src/alerts/manipulation-evaluator.ts] (신규)
  ├─ subscriptionId로 manipulation_alert_rules WHERE enabled=true 조회 (core DB)
  ├─ run + signals 로드 (페이로드용, core DB)
  ├─ getCollectorClient().subscriptions.get으로 keyword 로드 (collector DB, 페이로드용)
  ├─ 각 규칙: score >= scoreThreshold && cooldown 경과? → 발화
  ├─ buildPayload(run, signals, keyword, baseUrl)
  ├─ sendNotification(channel, message, data)  ← 기존 channels.ts 재사용
  └─ rule.lastTriggeredAt = now()  ← 발송 후 UPDATE

[apps/web tRPC]
[server/trpc/routers/manipulation-alerts.ts] (신규)
  - listBySubscription(subId)        → 규칙 배열
  - create({ subscriptionId, ... })  → 신규 규칙
  - update(ruleId, patch)            → 규칙 수정
  - delete(ruleId)                   → 규칙 삭제

[apps/web UI]
[components/manipulation/alert-rules-card.tsx] (신규)
  ├─ <RulesList>     — 규칙 row × N
  └─ <RuleEditor>    — 임계값 + 쿨다운 + 채널 (Slack URL or webhook URL+headers) 폼
  ↑ 구독 페이지 manipulation 탭 안에 마운트
```

**의존성 방향**: web → core (스키마 + evaluator). core 단방향 유지.

**기존 자산 재사용**:

- `alerts/channels.ts` `sendNotification()` — Slack/webhook 전송 (email 제외)
- `verifySubscriptionOwnership` — 권한 헬퍼

**기존 자산에 추가되는 변경**:

- `channels.ts`의 `sendSlackNotification`/`sendWebhookNotification`에 **5초 fetch timeout** 적용 (`AbortSignal.timeout(5000)`). 알림 호출이 worker를 멈추지 않게 강제.

## 데이터 모델

### 신규 테이블 — `packages/core/src/db/schema/manipulation.ts`에 추가

```typescript
// import에 doublePrecision, boolean 추가 필요 — drizzle-orm/pg-core
export const manipulationAlertRules = pgTable(
  'manipulation_alert_rules',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // 주의: keyword_subscriptions 테이블은 collector DB(별도 schema)에 있어 FK 불가.
    // manipulation_runs와 동일하게 외부 ID로만 다룸 (manipulation_runs.subscription_id도 FK 없음).
    subscriptionId: integer('subscription_id').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),

    scoreThreshold: real('score_threshold').notNull(), // 0-100 (manipulation_runs.manipulationScore와 동일 real 타입)
    cooldownMinutes: integer('cooldown_minutes').notNull().default(360),

    channel: jsonb('channel')
      .$type<
        | { type: 'slack'; webhookUrl: string }
        | { type: 'webhook'; url: string; headers?: Record<string, string> }
      >()
      .notNull(),

    lastTriggeredAt: timestamp('last_triggered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('manipulation_alert_rules_subscription_idx').on(table.subscriptionId),
    index('manipulation_alert_rules_enabled_idx').on(table.enabled),
  ],
);

export type ManipulationAlertRule = typeof manipulationAlertRules.$inferSelect;
export type NewManipulationAlertRule = typeof manipulationAlertRules.$inferInsert;
```

**설계 메모**:

- **DB 분리 주의**: 구독 테이블(`keyword_subscriptions`)은 collector DB에 위치, manipulation 테이블들은 core DB. FK 불가능 → `subscription_id`는 단순 integer (`manipulation_runs.subscription_id`와 동일 패턴). 구독 삭제 시 cascade 자동 정리는 안 됨 → 향후 cleanup 작업 필요 (이번 spec scope 외)
- `channel`은 discriminated union (`type` 필드로 분기). Zod 스키마에서도 동일 모양으로 받음
- `scoreThreshold`는 `real` (manipulation_runs.manipulationScore와 동일 타입; 점수가 57.21처럼 소수)
- `cooldownMinutes` default 360 = 6시간
- 1구독당 N개 규칙 허용 (점수 60→Slack, 점수 80→ops webhook 등). UNIQUE 제약 없음
- 마이그레이션: `pnpm db:push` (하이퍼테이블 아님, db:migrate-timescale 불필요). core schema 파일 import에 `boolean` 추가 필요 (`real`은 이미 사용 중)
- 기존 `alert_rules`/`alert_events` 테이블은 **건드리지 않음**

## 핵심 흐름

### 호출 위치 — `packages/core/src/analysis/manipulation/stage5.ts`

`persistRun` 호출 직후, `appendJobEvent` 직전. fire-and-forget:

```typescript
const runId = await persistRun(getDb(), { ... });

// 알림 평가 — 실패해도 stage5는 성공으로 마킹 (try/catch는 평가 함수 내부)
void evaluateManipulationAlerts({
  runId,
  jobId: args.jobId,
  subscriptionId,
});

await appendJobEvent(args.jobId, 'info', `manipulation 완료: ...`);
```

> **변경 포인트**: 현재 `stage5.ts`는 `persistRun`의 반환값(runId)을 버리고 있음. 한 줄 수정으로 변수에 받아 evaluator에 전달.

### evaluator 함수 — `packages/core/src/alerts/manipulation-evaluator.ts` (신규)

```typescript
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import {
  manipulationAlertRules,
  manipulationRuns,
  manipulationSignals,
} from '../db/schema/manipulation';
import { getCollectorClient } from '../collector-client';
import { sendNotification, type AlertChannel } from './channels';
import { createLogger } from '../utils/logger';

const log = createLogger('alerts:manipulation');

export interface EvaluateInput {
  runId: string;
  jobId: number;
  subscriptionId: number;
}

export async function evaluateManipulationAlerts(input: EvaluateInput): Promise<void> {
  try {
    // 1. 활성 규칙 조회 (core DB)
    const rules = await getDb()
      .select()
      .from(manipulationAlertRules)
      .where(
        and(
          eq(manipulationAlertRules.subscriptionId, input.subscriptionId),
          eq(manipulationAlertRules.enabled, true),
        ),
      );
    if (rules.length === 0) return;

    // 2. run + signals 로드 (core DB)
    const [run] = await getDb()
      .select()
      .from(manipulationRuns)
      .where(eq(manipulationRuns.id, input.runId))
      .limit(1);
    if (!run) {
      log.warn(`run ${input.runId} 없음 — 평가 중단`);
      return;
    }
    const signals = await getDb()
      .select()
      .from(manipulationSignals)
      .where(eq(manipulationSignals.runId, input.runId));

    // 3. 구독 정보 (collector tRPC) — 메시지의 keyword 표시용
    let keyword: string | null = null;
    try {
      const sub = await getCollectorClient()
        .subscriptions.get.query({ id: input.subscriptionId });
      keyword = (sub as { keyword?: string } | null)?.keyword ?? null;
    } catch (err) {
      log.warn(`collector 구독 조회 실패 (subId=${input.subscriptionId}):`, err);
      // 메시지에 fallback 표기로 진행
    }

    // 4. base URL — env 미설정 시 fallback + warn
    let baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      log.warn('APP_BASE_URL 미설정 — http://localhost:3000 폴백');
      baseUrl = 'http://localhost:3000';
    }

    // 5. 각 규칙 평가
    for (const rule of rules) {
      // 임계 미만이면 skip
      if (run.manipulationScore < rule.scoreThreshold) continue;

      // cooldown 검사
      if (rule.lastTriggeredAt) {
        const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime();
        if (elapsedMs < rule.cooldownMinutes * 60_000) {
          log.info(`rule ${rule.id} cooldown 중 — skip`);
          continue;
        }
      }

      // 6. 페이로드 빌드
      const topSignals = [...signals]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.signal);

      const subLabel = keyword ?? `구독 ${input.subscriptionId}`;
      const message = `🚨 ${subLabel} — manipulation 점수 ${run.manipulationScore.toFixed(1)} (임계값 ${rule.scoreThreshold})`;
      const data = {
        ruleId: rule.id,
        ruleName: rule.name,
        subscriptionId: input.subscriptionId,
        subscriptionKeyword: keyword,
        jobId: input.jobId,
        runId: input.runId,
        score: run.manipulationScore,
        confidence: run.confidenceFactor,
        threshold: rule.scoreThreshold,
        topSignals,
        showcaseUrl: `${baseUrl}/showcase/${input.jobId}`,
        triggeredAt: new Date().toISOString(),
      };

      // 7. 채널 변환 후 발송 (sendNotification은 내부에서 try/catch + log)
      const channel: AlertChannel =
        rule.channel.type === 'slack'
          ? { slack: { webhookUrl: rule.channel.webhookUrl } }
          : { webhook: { url: rule.channel.url, headers: rule.channel.headers } };
      await sendNotification(channel, message, data);

      // 8. lastTriggeredAt 업데이트 (발송 후)
      //    sendNotification이 성공/실패를 throw하지 않으므로 "시도했음"을 cooldown 시작점으로 함.
      //    발송 실패 시에도 cooldown 안에 있는 동안은 재시도 안 함 → 6시간 후 다음 run에서 자연 재시도.
      await getDb()
        .update(manipulationAlertRules)
        .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
        .where(eq(manipulationAlertRules.id, rule.id));

      log.info(`rule ${rule.id} 발화 완료: score=${run.manipulationScore} threshold=${rule.scoreThreshold}`);
    }
  } catch (err) {
    log.error('manipulation 알림 평가 실패:', err);
    // throw 안 함 — fire-and-forget
  }
}
```

### `channels.ts` 변경

기존 `sendSlackNotification`과 `sendWebhookNotification`의 `fetch` 호출에 5초 timeout 추가:

```typescript
const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(5000),
});
```

`AbortError` 시 기존 try/catch가 잡아 log만 남김 (현재 동작과 동일).

## tRPC Router

### `apps/web/src/server/trpc/routers/manipulation-alerts.ts` (신규)

```typescript
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb, manipulationAlertRules } from '@ai-signalcraft/core';
import { router, protectedProcedure } from '../init';
import { verifySubscriptionOwnership } from '../shared/verify-subscription-ownership';

const ChannelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('slack'),
    webhookUrl: z.string().url().startsWith('https://hooks.slack.com/'),
  }),
  z.object({
    type: z.literal('webhook'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
]);

const CreateInput = z.object({
  subscriptionId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  scoreThreshold: z.number().min(0).max(100),
  cooldownMinutes: z.number().int().min(1).max(10080).default(360), // 1주 max
  channel: ChannelSchema,
});

const UpdateInput = z.object({
  ruleId: z.number().int().positive(),
  patch: CreateInput.omit({ subscriptionId: true }).partial(),
});

export const manipulationAlertsRouter = router({
  listBySubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await verifySubscriptionOwnership(ctx, input.subscriptionId);
      return getDb()
        .select()
        .from(manipulationAlertRules)
        .where(eq(manipulationAlertRules.subscriptionId, input.subscriptionId))
        .orderBy(desc(manipulationAlertRules.createdAt));
    }),

  create: protectedProcedure.input(CreateInput).mutation(async ({ ctx, input }) => {
    await verifySubscriptionOwnership(ctx, input.subscriptionId);
    const [created] = await getDb()
      .insert(manipulationAlertRules)
      .values({
        subscriptionId: input.subscriptionId,
        name: input.name,
        enabled: input.enabled,
        scoreThreshold: input.scoreThreshold,
        cooldownMinutes: input.cooldownMinutes,
        channel: input.channel,
      })
      .returning();
    return created;
  }),

  update: protectedProcedure.input(UpdateInput).mutation(async ({ ctx, input }) => {
    // 1. 규칙 조회 → subscriptionId 확인
    const [rule] = await getDb()
      .select({ subscriptionId: manipulationAlertRules.subscriptionId })
      .from(manipulationAlertRules)
      .where(eq(manipulationAlertRules.id, input.ruleId))
      .limit(1);
    if (!rule) throw new TRPCError({ code: 'NOT_FOUND' });
    // 2. 권한
    await verifySubscriptionOwnership(ctx, rule.subscriptionId);
    // 3. UPDATE
    const [updated] = await getDb()
      .update(manipulationAlertRules)
      .set({ ...input.patch, updatedAt: new Date() })
      .where(eq(manipulationAlertRules.id, input.ruleId))
      .returning();
    return updated;
  }),

  delete: protectedProcedure
    .input(z.object({ ruleId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await getDb()
        .select({ subscriptionId: manipulationAlertRules.subscriptionId })
        .from(manipulationAlertRules)
        .where(eq(manipulationAlertRules.id, input.ruleId))
        .limit(1);
      if (!rule) throw new TRPCError({ code: 'NOT_FOUND' });
      await verifySubscriptionOwnership(ctx, rule.subscriptionId);
      await getDb()
        .delete(manipulationAlertRules)
        .where(eq(manipulationAlertRules.id, input.ruleId));
      return { ok: true as const };
    }),
});
```

**Router 등록**: `apps/web/src/server/trpc/router.ts`에 `manipulationAlerts: manipulationAlertsRouter` 추가.

## UI

### `<AlertRulesCard subscriptionId={N} />` — `apps/web/src/components/manipulation/alert-rules-card.tsx`

구독 페이지 manipulation 탭 (= TimeseriesView) 위 또는 아래에 마운트되는 카드.

```
┌─ 알림 규칙 ──────────────────────── [+ 규칙 추가] ┐
│  ・규칙명                                          │
│  ・점수 ≥ 60   쿨다운 6시간   Slack    ON ▣       │
│      [편집] [삭제]                                  │
│  ・규칙명 #2                                        │
│  ・점수 ≥ 80   쿨다운 1시간   Webhook  ON ▣       │
│      [편집] [삭제]                                  │
│  (규칙 없음 시: "이 구독에 알림 규칙이 없습니다.   │
│   임계값을 정하면 점수가 그 이상일 때 Slack/webhook │
│   으로 통보됩니다.")                                 │
└─────────────────────────────────────────────────────┘
```

### `<RuleEditorDialog>` 폼 필드

| 필드 | 타입 | 검증 |
|------|------|------|
| 이름 | text input | 1-100자 |
| 활성화 | switch | bool |
| 점수 임계값 | number input | 0-100, step 0.1 |
| 쿨다운(분) | number input | 1-10080, default 360 |
| 채널 타입 | radio (Slack \| webhook) | discriminated union |
| **Slack 선택 시** Slack webhook URL | text input | `https://hooks.slack.com/` 시작 |
| **Webhook 선택 시** URL | text input | URL 형식 |
| **Webhook 선택 시** Headers | key/value 목록 (선택) | 옵션 |

폼 제출 → `manipulationAlerts.create` 또는 `update` mutate → useQuery invalidate → 카드 갱신.

### 마운트 위치

`/subscriptions/[id]/page.tsx`의 manipulation 탭 컴포넌트(현재 `TimeseriesView` 단독 마운트) 직전에 카드 추가:

```typescript
<>
  <AlertRulesCard subscriptionId={id} />
  <TimeseriesView subscriptionId={id} />
</>
```

## 환경 변수

`.env.example`과 운영 `.env`에 추가:

```bash
# 알림 메시지 안의 showcase 링크 base URL
# 미설정 시 worker는 http://localhost:3000 으로 폴백 + warn 로그
APP_BASE_URL=https://signalcraft.example.com
```

> **메모**: 이 값은 worker 컨테이너에도 설정되어야 함. 메모리에 worker env drift 패턴이 있으니 변경 후 `dserver restart ais-prod-worker` (또는 manipulation을 실행하는 worker) 필요.

## 권한·격리 모델

| 영역 | 검증 |
|------|------|
| `listBySubscription` | `verifySubscriptionOwnership(ctx, subscriptionId)` |
| `create` | `verifySubscriptionOwnership(ctx, input.subscriptionId)` |
| `update` | rule 조회 → 그 rule의 subscriptionId로 검증 |
| `delete` | 동일 |
| Slack URL whitelist | Zod에서 `https://hooks.slack.com/`로 시작 강제 (SSRF 1차 방어) |
| Webhook URL 검증 | Zod URL 검증만 (사용자 책임) |
| Webhook headers XSS | JSON으로 그대로 전송, render 없음 |

> **참고**: webhook URL은 사용자가 임의 도메인을 입력 가능. SSRF 위협이 있으나 (a) 인증된 사용자만 접근, (b) 5초 timeout으로 영향 제한, (c) 응답 내용을 화면에 노출하지 않음으로 mitigate. 운영 추가 정책(allowlist 등)은 다음 spec.

## 에러 처리

| 시나리오 | 처리 |
|----------|------|
| `manipulation_alert_rules` 행 없음 | EmptyState ("이 구독에 알림 규칙이 없습니다.") |
| Slack webhook 4xx/5xx | `sendNotification` 내부 try/catch → log only. lastTriggeredAt은 UPDATE됨 |
| Slack/webhook timeout (5초 초과) | `AbortError` → log only |
| `APP_BASE_URL` 미설정 | localhost 폴백 + warn |
| evaluator 자체 throw | 외부 try/catch로 수집 → log. stage5 흐름 영향 없음 |
| run 조회 결과 없음 (race) | warn log + return |
| Form 제출 권한 거부 | `verifySubscriptionOwnership`이 NOT_FOUND throw → toast |

## 테스트

### evaluator 단위 테스트 (`packages/core/src/alerts/__tests__/manipulation-evaluator.test.ts`) — 신규

`getDb()`/`sendNotification`/`getCollectorClient` mock. 다음 5케이스:

1. **임계 미만 — 발화 없음**: rule.scoreThreshold=70, run.score=50 → `sendNotification` 호출 0회, lastTriggeredAt 변경 없음
2. **임계 이상 + cooldown 경과 — 발화**: rule.scoreThreshold=50, run.score=60, lastTriggeredAt=null → `sendNotification` 1회 호출, payload에 score/confidence/topSignals/subscriptionKeyword/showcaseUrl 포함, lastTriggeredAt UPDATE. `getCollectorClient` mock으로 keyword 주입
3. **임계 이상 + cooldown 미경과 — skip**: scoreThreshold=50, run.score=60, lastTriggeredAt = now()-1h, cooldownMinutes=360 → `sendNotification` 호출 0회, lastTriggeredAt 변경 없음
4. **활성 규칙 없음 — 조기 종료**: enabled=false 또는 행 없음 → run/sub 조회조차 하지 않음 (early return)
5. **collector 구독 조회 실패 — graceful**: `getCollectorClient().subscriptions.get` throw → keyword=null로 진행, 메시지에 `구독 {id}` fallback 표기, sendNotification 정상 호출

### router 단위 테스트 (`apps/web/src/server/trpc/routers/__tests__/manipulation-alerts.test.ts`) — 신규

`getDb()`/`verifySubscriptionOwnership` mock. 5케이스:

1. **listBySubscription 권한 없음** — `verifySubscriptionOwnership` throw → router throw 전파
2. **listBySubscription 정상** — 구독의 규칙 N건, createdAt DESC
3. **create 정상** — Zod 검증 통과 → INSERT 호출, returning row 반환
4. **create Slack URL 도메인 위반** — `https://example.com/...` → Zod 에러 (router 호출 전)
5. **update/delete 권한 없음** — rule 조회 후 verifySubscriptionOwnership throw → 전파

### channels timeout 테스트 (`packages/core/src/alerts/__tests__/channels.test.ts`) — 기존/신규

1. `fetch`가 5초 초과로 AbortError 발생 → `sendNotification`은 throw 안 함, log만

### E2E (수동)

1. 구독 페이지에서 규칙 생성 (점수≥30, Slack URL) → DB row 확인
2. manipulation 분석 트리거 (jobId=273 데이터 재현 시 score=57.21이라 발화 예상) → Slack 메시지 수신
3. 같은 구독에 다시 분석 → cooldown으로 skip 확인
4. cooldown 시간 단축(예: 1분)으로 update → 다음 분석에서 재발화
5. APP_BASE_URL 미설정으로 worker 재시작 → 로그에 warn + localhost 링크

## 파일 영향 요약

| 카테고리 | 파일 수 | 라인 (추정) |
|----------|---------|-------------|
| **DB schema 추가** (`manipulation.ts`에 테이블 + types) | 1 (수정) | +60 |
| **신규 evaluator** | 1 | ~130 |
| **`channels.ts` timeout 적용** | 1 (수정) | +6 |
| **stage5.ts evaluator 호출** | 1 (수정) | +6 |
| **신규 router + Zod 스키마** | 1 | ~120 |
| **router 등록** | 1 (수정) | +2 |
| **신규 UI 컴포넌트** (card + editor dialog) | 2 | ~300 |
| **구독 페이지 마운트** | 1 (수정) | +5 |
| **테스트** (evaluator 5 + router 5 + channels 1) | 2~3 | ~360 |
| **`.env.example`** | 1 (수정) | +3 |
| **합계** | ~12 | ~970 |

## 위험 요소

| 위험 | 영향 | 완화 |
|------|------|------|
| webhook 호출이 worker를 멈춤 | 높음 | 5초 timeout 강제 (`AbortSignal.timeout(5000)`) |
| `APP_BASE_URL` 미설정으로 잘못된 링크 | 중 | warn 로그 + localhost 폴백, `.env.example` 명시 |
| Slack URL 이외 도메인 입력 (오타) | 낮음 | Zod의 `startsWith('https://hooks.slack.com/')` |
| evaluator 자체 예외로 stage5 흐름 멈춤 | 중 | 함수 전체 try/catch + `void` 호출 |
| 동시 worker가 같은 rule 평가 → 중복 발송 | 낮음 | manipulation은 잡 단위 큐라 동일 subscription 동시 실행 가능성 매우 낮음. cooldown UPDATE가 대략적 가드 역할 |
| webhook URL SSRF | 중 | 인증된 사용자만 접근, 5초 timeout, 응답 미노출. 운영 allowlist는 다음 spec |
| sendNotification이 발송 실패를 throw하지 않음 → 실패해도 cooldown 잠김 | 낮음 | 다음 run에서 임계 초과면 cooldown 경과 후 자동 재시도. 운영 영향 6시간 |
| email 토글 노출 안 됨 | 낮음 | UI에서 email 옵션 미렌더링. 사용자가 기대하지 않게 됨 |
| 구독이 collector DB에서 삭제되어도 manipulation_alert_rules는 남음 | 낮음 | FK 불가 (DB 분리). 발화 시 collector 조회 실패 → keyword=null로 graceful 진행. 운영 cleanup은 향후 작업 |
| collector tRPC 호출 실패가 evaluator를 죽임 | 낮음 | try/catch로 감싸 keyword=null fallback |

## 마이그레이션

- `pnpm db:push` 1회 (개발/운영 각각, DB 공유라 둘 중 한쪽 한 번)
- 기존 jobId=273의 run에는 영향 없음 (규칙 0건)
- `APP_BASE_URL` env를 worker 컨테이너에 추가 후 재시작

## 향후 확장 (이 스펙 범위 외)

- email 채널: Resend API 통합, 발신 도메인 검증, 템플릿
- 점수 외 트리거: 신뢰도 동시 충족, spike(직전 대비 변화량), 신호별 임계값
- 발화 이력 페이지: `alert_events` 통합 또는 신규 `manipulation_alert_events` 테이블
- 재시도 큐: 발송 실패 시 BullMQ exponential backoff
- 글로벌 알림 페이지: `/alerts` 페이지에서 구독 무관하게 모든 규칙 관리
- 필터/검색·CSV 익스포트: Phase 4의 별도 spec
