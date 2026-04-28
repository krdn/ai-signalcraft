# Manipulation Alerts (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** manipulation 분석이 끝난 후 점수가 임계값을 넘으면 Slack/webhook으로 자동 통보하는 기능을 추가한다.

**Architecture:** core DB에 신규 `manipulation_alert_rules` 테이블, `packages/core/src/alerts/manipulation-evaluator.ts`가 stage5 직후 fire-and-forget으로 호출되어 활성 규칙을 평가하고 cooldown을 지키며 발화한다. 웹은 구독 페이지 manipulation 탭 안의 `<AlertRulesCard>`에서 CRUD를 제공한다. email은 비목표.

**Tech Stack:** Drizzle ORM (real/jsonb), tRPC 11 + Zod (discriminated union), 기존 `alerts/channels.ts`의 `sendNotification`(Slack/webhook), shadcn/ui (Card/Dialog/Switch/Input), Vitest (단위 테스트), TanStack Query (UI invalidate).

**Spec:** [`docs/superpowers/specs/2026-04-28-manipulation-phase4-alerts-design.md`](../specs/2026-04-28-manipulation-phase4-alerts-design.md)

---

## File Structure

이 plan에서 생성/수정하는 파일과 책임:

**core 패키지**
- Modify: `packages/core/src/db/schema/manipulation.ts` — `manipulationAlertRules` 테이블 + 타입 추가
- Modify: `packages/core/src/alerts/channels.ts` — `fetch`에 `AbortSignal.timeout(5000)` 추가
- Create: `packages/core/src/alerts/manipulation-evaluator.ts` — 평가/발화 로직
- Modify: `packages/core/src/alerts/index.ts` — `evaluateManipulationAlerts` export
- Modify: `packages/core/src/analysis/manipulation/stage5.ts` — `persistRun` 직후 evaluator 호출
- Create: `packages/core/src/alerts/__tests__/manipulation-evaluator.test.ts` — 5케이스
- Modify: `packages/core/src/alerts/__tests__/channels.test.ts` (또는 신규) — timeout 1케이스

**web 패키지**
- Create: `apps/web/src/server/trpc/routers/manipulation-alerts.ts` — tRPC router (list/create/update/delete)
- Modify: `apps/web/src/server/trpc/router.ts` — `manipulationAlerts` 등록
- Create: `apps/web/src/server/trpc/routers/__tests__/manipulation-alerts.test.ts` — 5케이스
- Create: `apps/web/src/components/manipulation/alert-rules-card.tsx` — 규칙 카드 + Editor Dialog
- Modify: `apps/web/src/app/subscriptions/[id]/page.tsx` — 카드 마운트

**환경**
- Modify: `.env.example` — `APP_BASE_URL` 추가

---

## Task 1: 신규 테이블 추가 (`manipulation_alert_rules`)

**Files:**
- Modify: `packages/core/src/db/schema/manipulation.ts`

- [ ] **Step 1: 현재 schema 파일 import 라인 확인**

Run: `sed -n '1,12p' packages/core/src/db/schema/manipulation.ts`
Expected: `pgTable, text, timestamp, integer, jsonb, real, uuid, index, uniqueIndex` import 확인. `boolean`은 없음.

- [ ] **Step 2: import에 `boolean` 추가**

`packages/core/src/db/schema/manipulation.ts`의 import 블록 (1-11 line 영역)에서:

```typescript
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  real,
  uuid,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
```

`boolean`을 `uuid` 뒤에 추가.

- [ ] **Step 3: 파일 끝부분 (`type NewManipulationEvidence`까지의 export type 라인 다음)에 신규 테이블 추가**

```typescript
// manipulation 알림 규칙 — 구독 단위, score 임계값 + cooldown + Slack/webhook 채널
// 주의: keyword_subscriptions(collector DB)는 별도 schema라 FK 불가.
// manipulation_runs.subscription_id와 동일하게 단순 integer로 보관.
export const manipulationAlertRules = pgTable(
  'manipulation_alert_rules',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    subscriptionId: integer('subscription_id').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),

    scoreThreshold: real('score_threshold').notNull(),
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

- [ ] **Step 4: 타입 체크 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core typecheck`
Expected: 새 테이블·타입 관련 에러 없음. (전체 typecheck 시 무관 에러 무시)

- [ ] **Step 5: DB push**

Run: `pnpm db:push`
Expected: `manipulation_alert_rules` 테이블 생성, 두 개 인덱스 생성. 프롬프트가 나오면 enter 또는 yes.

- [ ] **Step 6: psql로 테이블 존재 확인**

Run: `psql postgresql://postgres:postgres@192.168.0.5:5438/ai_signalcraft -c '\d manipulation_alert_rules'`
Expected: 컬럼 9개(id, subscription_id, name, enabled, score_threshold, cooldown_minutes, channel, last_triggered_at, created_at, updated_at) + 두 인덱스 노출.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/db/schema/manipulation.ts
git commit -m "feat(core): manipulation_alert_rules 테이블 추가"
```

---

## Task 2: `channels.ts`에 5초 fetch timeout 적용

**Files:**
- Modify: `packages/core/src/alerts/channels.ts`

- [ ] **Step 1: 기존 `sendSlackNotification`의 fetch 호출 위치 확인**

Run: `grep -n "fetch(webhookUrl" packages/core/src/alerts/channels.ts`
Expected: 한 줄. (별도 timeout 옵션 없음)

- [ ] **Step 2: Slack fetch에 5초 timeout 추가**

`packages/core/src/alerts/channels.ts`에서 `sendSlackNotification` 안의 `fetch(webhookUrl, { ... })` 호출에 `signal: AbortSignal.timeout(5000)` 추가:

```typescript
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
```

- [ ] **Step 3: webhook fetch에도 동일 timeout 추가**

`sendWebhookNotification`의 `fetch(url, { ... })` 호출에도:

```typescript
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      message,
      data,
      timestamp: new Date().toISOString(),
      source: 'ai-signalcraft',
    }),
    signal: AbortSignal.timeout(5000),
  });
```

- [ ] **Step 4: timeout 동작 단위 테스트 추가**

기존 파일 존재 여부 확인:

Run: `ls packages/core/src/alerts/__tests__/ 2>/dev/null`
- 존재 시: `channels.test.ts` 파일에 추가 (없으면 신규 생성).

다음 신규 파일을 작성: `packages/core/src/alerts/__tests__/channels.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendNotification } from '../channels';

describe('channels — fetch timeout', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('Slack webhook fetch가 5초 초과로 abort되면 throw 없이 graceful 종료', async () => {
    // fetch가 AbortError 발생시키도록 mock — sendNotification은 내부에서 catch하므로 throw 안 함.
    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }
      });
    }) as typeof fetch;

    const promise = sendNotification(
      { slack: { webhookUrl: 'https://hooks.slack.com/services/T0/B0/X' } },
      'test',
      {},
    );

    // 5초 시뮬레이션
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test channels`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/alerts/channels.ts packages/core/src/alerts/__tests__/channels.test.ts
git commit -m "feat(core): alerts/channels fetch에 5초 timeout 적용 + 테스트"
```

---

## Task 3: evaluator 단위 테스트 작성 (TDD — 실패하는 테스트 먼저)

**Files:**
- Create: `packages/core/src/alerts/__tests__/manipulation-evaluator.test.ts`

- [ ] **Step 1: 테스트 파일 신규 작성 — 5케이스 모두 포함**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendNotification = vi.fn();
const collectorGet = vi.fn();
const dbSelect = vi.fn();
const dbUpdate = vi.fn();

vi.mock('../channels', () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}));

vi.mock('../../collector-client', () => ({
  getCollectorClient: () => ({
    subscriptions: { get: { query: (...args: unknown[]) => collectorGet(...args) } },
  }),
}));

vi.mock('../../db', () => ({
  getDb: () => ({
    select: (...args: unknown[]) => dbSelect(...args),
    update: (...args: unknown[]) => dbUpdate(...args),
  }),
}));

import { evaluateManipulationAlerts } from '../manipulation-evaluator';

// helper: drizzle chain mock — select().from(table).where(cond).limit?(n)
function makeSelectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
        // limit 미사용 케이스도 then으로 await 가능하게
        then: (resolve: (v: unknown[]) => unknown) => resolve(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  const setSpy = vi.fn().mockReturnValue({
    where: () => Promise.resolve(),
  });
  return { set: setSpy, _setSpy: setSpy };
}

const baseRule = {
  id: 1,
  subscriptionId: 37,
  name: '기본 규칙',
  enabled: true,
  scoreThreshold: 50,
  cooldownMinutes: 360,
  channel: { type: 'slack' as const, webhookUrl: 'https://hooks.slack.com/services/X/Y/Z' },
  lastTriggeredAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseRun = {
  id: 'run-1',
  jobId: 273,
  subscriptionId: 37,
  status: 'completed',
  manipulationScore: 60,
  confidenceFactor: 0.8,
};

describe('evaluateManipulationAlerts', () => {
  beforeEach(() => {
    sendNotification.mockReset();
    collectorGet.mockReset();
    dbSelect.mockReset();
    dbUpdate.mockReset();
  });

  it('1. 임계 미만이면 발화 없음 + lastTriggeredAt 변경 없음', async () => {
    const rule = { ...baseRule, scoreThreshold: 70 };
    const run = { ...baseRun, manipulationScore: 50 };
    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule])) // 규칙
      .mockReturnValueOnce(makeSelectChain([run])) // run
      .mockReturnValueOnce(makeSelectChain([])); // signals
    collectorGet.mockResolvedValue({ keyword: '대선' });

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('2. 임계 이상 + cooldown 경과 — 발화 + payload 검증 + lastTriggeredAt UPDATE', async () => {
    const rule = { ...baseRule, scoreThreshold: 50, lastTriggeredAt: null };
    const run = { ...baseRun, manipulationScore: 60, confidenceFactor: 0.84 };
    const signals = [
      { id: 's1', signal: 'burst', score: 80 },
      { id: 's2', signal: 'similarity', score: 70 },
      { id: 's3', signal: 'vote', score: 60 },
      { id: 's4', signal: 'temporal', score: 30 },
    ];
    const updateChain = makeUpdateChain();

    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain(signals));
    collectorGet.mockResolvedValue({ keyword: '대선' });
    dbUpdate.mockReturnValue(updateChain);

    process.env.APP_BASE_URL = 'https://signalcraft.example.com';
    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [channel, message, data] = sendNotification.mock.calls[0];
    expect(channel).toEqual({ slack: { webhookUrl: rule.channel.webhookUrl } });
    expect(message).toContain('대선');
    expect(message).toContain('60.0');
    expect(message).toContain('50');
    expect(data).toMatchObject({
      ruleId: 1,
      subscriptionId: 37,
      jobId: 273,
      runId: 'run-1',
      score: 60,
      confidence: 0.84,
      threshold: 50,
      topSignals: ['burst', 'similarity', 'vote'],
      showcaseUrl: 'https://signalcraft.example.com/showcase/273',
      subscriptionKeyword: '대선',
    });
    expect(dbUpdate).toHaveBeenCalledTimes(1);
    expect(updateChain._setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lastTriggeredAt: expect.any(Date) }),
    );
  });

  it('3. 임계 이상 + cooldown 미경과 — skip', async () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000); // 1시간 전
    const rule = { ...baseRule, scoreThreshold: 50, cooldownMinutes: 360, lastTriggeredAt: recent };
    const run = { ...baseRun, manipulationScore: 60 };
    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain([]));
    collectorGet.mockResolvedValue({ keyword: '대선' });

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('4. 활성 규칙 없음 — early return (run 조회조차 안 함)', async () => {
    dbSelect.mockReturnValueOnce(makeSelectChain([]));

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(dbSelect).toHaveBeenCalledTimes(1);
    expect(collectorGet).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('5. collector 구독 조회 실패 — keyword=null로 graceful, 발화 정상', async () => {
    const rule = { ...baseRule, scoreThreshold: 50 };
    const run = { ...baseRun, manipulationScore: 60 };
    dbSelect
      .mockReturnValueOnce(makeSelectChain([rule]))
      .mockReturnValueOnce(makeSelectChain([run]))
      .mockReturnValueOnce(makeSelectChain([]));
    collectorGet.mockRejectedValue(new Error('collector down'));
    dbUpdate.mockReturnValue(makeUpdateChain());

    await evaluateManipulationAlerts({ runId: 'run-1', jobId: 273, subscriptionId: 37 });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [, message, data] = sendNotification.mock.calls[0];
    expect(message).toContain('구독 37'); // fallback label
    expect(data.subscriptionKeyword).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 모듈 미존재로 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core test manipulation-evaluator`
Expected: FAIL with "Cannot find module '../manipulation-evaluator'" 또는 import 에러.

- [ ] **Step 3: Commit (실패하는 테스트)**

```bash
git add packages/core/src/alerts/__tests__/manipulation-evaluator.test.ts
git commit -m "test(core): manipulation-evaluator 5케이스 — 실패하는 테스트 (TDD)"
```

---

## Task 4: evaluator 구현

**Files:**
- Create: `packages/core/src/alerts/manipulation-evaluator.ts`
- Modify: `packages/core/src/alerts/index.ts`

- [ ] **Step 1: 신규 파일 작성**

`packages/core/src/alerts/manipulation-evaluator.ts`:

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
    // 1. 활성 규칙 (core DB)
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

    // 2. run + signals (core DB)
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

    // 3. 구독 keyword (collector tRPC) — 실패해도 graceful
    let keyword: string | null = null;
    try {
      const sub = await getCollectorClient()
        .subscriptions.get.query({ id: input.subscriptionId });
      keyword = (sub as { keyword?: string } | null)?.keyword ?? null;
    } catch (err) {
      log.warn(`collector 구독 조회 실패 (subId=${input.subscriptionId}):`, err);
    }

    // 4. base URL
    let baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      log.warn('APP_BASE_URL 미설정 — http://localhost:3000 폴백');
      baseUrl = 'http://localhost:3000';
    }

    // 5. 각 규칙 평가
    for (const rule of rules) {
      // manipulationScore가 nullable이라는 것 — 보통 'completed' run이면 값 존재. 방어적으로 null 체크.
      if (run.manipulationScore == null) continue;
      if (run.manipulationScore < rule.scoreThreshold) continue;

      if (rule.lastTriggeredAt) {
        const elapsedMs = Date.now() - rule.lastTriggeredAt.getTime();
        if (elapsedMs < rule.cooldownMinutes * 60_000) {
          log.info(`rule ${rule.id} cooldown 중 — skip`);
          continue;
        }
      }

      // 6. 페이로드
      const topSignals = [...signals]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
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

      // 7. 발송
      const channel: AlertChannel =
        rule.channel.type === 'slack'
          ? { slack: { webhookUrl: rule.channel.webhookUrl } }
          : { webhook: { url: rule.channel.url, headers: rule.channel.headers } };
      await sendNotification(channel, message, data);

      // 8. lastTriggeredAt UPDATE (발송 후)
      await getDb()
        .update(manipulationAlertRules)
        .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
        .where(eq(manipulationAlertRules.id, rule.id));

      log.info(
        `rule ${rule.id} 발화 완료: score=${run.manipulationScore} threshold=${rule.scoreThreshold}`,
      );
    }
  } catch (err) {
    log.error('manipulation 알림 평가 실패:', err);
  }
}
```

- [ ] **Step 2: barrel에 export 추가**

`packages/core/src/alerts/index.ts`에 한 줄 추가:

```typescript
export { evaluateManipulationAlerts } from './manipulation-evaluator';
```

- [ ] **Step 3: 테스트 실행 — 5케이스 모두 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core test manipulation-evaluator`
Expected: 5 passed.

- [ ] **Step 4: typecheck 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core typecheck`
Expected: 새 파일 관련 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/alerts/manipulation-evaluator.ts packages/core/src/alerts/index.ts
git commit -m "feat(core): manipulation-evaluator 구현"
```

---

## Task 5: stage5에서 evaluator 호출

**Files:**
- Modify: `packages/core/src/analysis/manipulation/stage5.ts`

- [ ] **Step 1: 현재 stage5 구조 재확인**

Run: `sed -n '50,70p' packages/core/src/analysis/manipulation/stage5.ts`
Expected: `await persistRun(getDb(), { ... });` 와 직후 `await appendJobEvent(...);` 발견.

- [ ] **Step 2: persistRun 반환값을 받고 evaluator 호출 추가**

`packages/core/src/analysis/manipulation/stage5.ts`의 try 블록 안 `persistRun` 호출을 다음과 같이 수정:

```typescript
    const runId = await persistRun(getDb(), {
      jobId: args.jobId,
      subscriptionId,
      output,
      weightsVersion: `v1-${config.domain}`,
    });

    // 알림 평가 — fire-and-forget. evaluator는 내부에서 모든 예외를 catch.
    void evaluateManipulationAlerts({
      runId,
      jobId: args.jobId,
      subscriptionId,
    });

    await appendJobEvent(
      args.jobId,
      'info',
      `manipulation 완료: score=${output.aggregate.manipulationScore.toFixed(1)}, confidence=${output.aggregate.confidenceFactor.toFixed(2)}`,
    );
```

- [ ] **Step 3: import 추가**

파일 상단 import 영역(`import { persistRun } from './persist';` 인근)에 다음 추가:

```typescript
import { evaluateManipulationAlerts } from '../../alerts/manipulation-evaluator';
```

- [ ] **Step 4: 기존 stage5 테스트 실행으로 회귀 없음 확인**

Run: `pnpm --filter @ai-signalcraft/core test stage5`
Expected: 기존 테스트 그대로 통과. (evaluator는 fire-and-forget이라 mock 없이도 throw하지 않음)

만약 stage5 테스트가 실패한다면: 신규 import가 collector-client/db chain을 깨우는 경우 — 그 테스트 파일에서 `evaluateManipulationAlerts`도 mock 추가:

```typescript
vi.mock('../../../alerts/manipulation-evaluator', () => ({
  evaluateManipulationAlerts: vi.fn(),
}));
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analysis/manipulation/stage5.ts packages/core/src/analysis/manipulation/__tests__/stage5.test.ts
git commit -m "feat(core): stage5 → manipulation 알림 평가 fire-and-forget 호출"
```

(테스트 파일은 mock 추가가 필요했을 때만 add. 변경 없었다면 stage5.ts만 stage 후 commit.)

---

## Task 6: tRPC router 단위 테스트 작성 (TDD)

**Files:**
- Create: `apps/web/src/server/trpc/routers/__tests__/manipulation-alerts.test.ts`

- [ ] **Step 1: 테스트 파일 신규 작성 — 5케이스**

기존 `manipulation.test.ts` mock 패턴 그대로 차용:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const verifySubscriptionOwnership = vi.fn();
const dbSelect = vi.fn();
const dbInsert = vi.fn();
const dbUpdate = vi.fn();
const dbDelete = vi.fn();

vi.mock('../../../auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock('next-auth', () => ({ default: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockReturnValue({ get: vi.fn() }) }));
vi.mock('../../shared/verify-subscription-ownership', () => ({
  verifySubscriptionOwnership: (...args: unknown[]) => verifySubscriptionOwnership(...args),
}));
vi.mock('@ai-signalcraft/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ai-signalcraft/core');
  return {
    ...actual,
    getDb: () => ({
      select: (...args: unknown[]) => dbSelect(...args),
      insert: (...args: unknown[]) => dbInsert(...args),
      update: (...args: unknown[]) => dbUpdate(...args),
      delete: (...args: unknown[]) => dbDelete(...args),
    }),
  };
});

import { manipulationAlertsRouter } from '../manipulation-alerts';

const ctx = {
  session: { user: { id: 'u1', role: 'admin' } },
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ teamId: 1, role: 'admin' }]) }) }),
    }),
  },
  userId: 'u1',
  teamId: 1,
} as never;

const slackChannel = {
  type: 'slack' as const,
  webhookUrl: 'https://hooks.slack.com/services/T0/B0/X',
};

describe('manipulationAlertsRouter', () => {
  beforeEach(() => {
    verifySubscriptionOwnership.mockReset();
    dbSelect.mockReset();
    dbInsert.mockReset();
    dbUpdate.mockReset();
    dbDelete.mockReset();
  });

  it('1. listBySubscription — 권한 거부는 throw 전파', async () => {
    verifySubscriptionOwnership.mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: '권한 없음' }),
    );
    await expect(
      manipulationAlertsRouter.createCaller(ctx).listBySubscription({ subscriptionId: 37 }),
    ).rejects.toThrow(/권한 없음/);
  });

  it('2. listBySubscription — 정상 조회', async () => {
    verifySubscriptionOwnership.mockResolvedValue(undefined);
    const rows = [
      { id: 1, subscriptionId: 37, name: 'r1', enabled: true, scoreThreshold: 60 },
    ];
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }),
    });
    const result = await manipulationAlertsRouter
      .createCaller(ctx)
      .listBySubscription({ subscriptionId: 37 });
    expect(result).toEqual(rows);
  });

  it('3. create — 정상 INSERT', async () => {
    verifySubscriptionOwnership.mockResolvedValue(undefined);
    const created = { id: 1, subscriptionId: 37, name: '기본', scoreThreshold: 60 };
    dbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([created]) }),
    });
    const result = await manipulationAlertsRouter.createCaller(ctx).create({
      subscriptionId: 37,
      name: '기본',
      scoreThreshold: 60,
      cooldownMinutes: 360,
      enabled: true,
      channel: slackChannel,
    });
    expect(result).toEqual(created);
  });

  it('4. create — Slack URL 도메인 위반 시 Zod throw', async () => {
    await expect(
      manipulationAlertsRouter.createCaller(ctx).create({
        subscriptionId: 37,
        name: '나쁜 규칙',
        scoreThreshold: 60,
        cooldownMinutes: 360,
        enabled: true,
        channel: { type: 'slack', webhookUrl: 'https://example.com/hook' },
      }),
    ).rejects.toThrow();
    expect(verifySubscriptionOwnership).not.toHaveBeenCalled();
  });

  it('5. update — rule 권한 거부 전파', async () => {
    // rule 조회는 통과시키고, verifySubscriptionOwnership에서 throw
    dbSelect.mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ subscriptionId: 99 }]) }),
      }),
    });
    verifySubscriptionOwnership.mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: '권한 없음' }),
    );

    await expect(
      manipulationAlertsRouter.createCaller(ctx).update({
        ruleId: 1,
        patch: { scoreThreshold: 80 },
      }),
    ).rejects.toThrow(/권한 없음/);
    expect(dbUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 모듈 미존재로 실패 확인**

Run: `pnpm --filter @ai-signalcraft/web test manipulation-alerts`
Expected: FAIL with module not found.

- [ ] **Step 3: Commit (실패하는 테스트)**

```bash
git add apps/web/src/server/trpc/routers/__tests__/manipulation-alerts.test.ts
git commit -m "test(web): manipulation-alerts router 5케이스 — 실패 (TDD)"
```

---

## Task 7: tRPC router 구현 + 등록

**Files:**
- Create: `apps/web/src/server/trpc/routers/manipulation-alerts.ts`
- Modify: `apps/web/src/server/trpc/router.ts`

- [ ] **Step 1: 신규 router 파일 작성**

`apps/web/src/server/trpc/routers/manipulation-alerts.ts`:

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
    webhookUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith('https://hooks.slack.com/'), {
        message: 'Slack webhook은 https://hooks.slack.com/ 도메인이어야 합니다',
      }),
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
  cooldownMinutes: z.number().int().min(1).max(10080).default(360),
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
    const [rule] = await getDb()
      .select({ subscriptionId: manipulationAlertRules.subscriptionId })
      .from(manipulationAlertRules)
      .where(eq(manipulationAlertRules.id, input.ruleId))
      .limit(1);
    if (!rule) throw new TRPCError({ code: 'NOT_FOUND' });
    await verifySubscriptionOwnership(ctx, rule.subscriptionId);
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

- [ ] **Step 2: root router 등록**

`apps/web/src/server/trpc/router.ts`의 import 영역에 추가:

```typescript
import { manipulationAlertsRouter } from './routers/manipulation-alerts';
```

`appRouter` 객체에 `manipulation: manipulationRouter,` 다음 줄에 추가:

```typescript
  manipulationAlerts: manipulationAlertsRouter,
```

- [ ] **Step 3: 테스트 실행 — 5케이스 통과**

Run: `pnpm --filter @ai-signalcraft/web test manipulation-alerts`
Expected: 5 passed.

- [ ] **Step 4: typecheck**

Run: `pnpm --filter @ai-signalcraft/web typecheck`
Expected: 새 파일 관련 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/trpc/routers/manipulation-alerts.ts apps/web/src/server/trpc/router.ts
git commit -m "feat(web): manipulationAlerts router (CRUD + Zod 채널 검증)"
```

---

## Task 8: AlertRulesCard UI 컴포넌트 (List + Editor Dialog)

**Files:**
- Create: `apps/web/src/components/manipulation/alert-rules-card.tsx`

- [ ] **Step 1: 사용 가능한 shadcn/ui 컴포넌트 확인**

Run: `ls apps/web/src/components/ui/`
Expected: `card`, `dialog`, `button`, `input`, `switch`, `label`, `tabs` 등 이름 노출. (없는 컴포넌트는 plain HTML/Tailwind로 대체)

- [ ] **Step 2: 컴포넌트 작성**

`apps/web/src/components/manipulation/alert-rules-card.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Rule = Awaited<
  ReturnType<typeof trpcClient.manipulationAlerts.listBySubscription.query>
>[number];

interface Props {
  subscriptionId: number;
}

interface FormState {
  id?: number;
  name: string;
  enabled: boolean;
  scoreThreshold: number;
  cooldownMinutes: number;
  channelType: 'slack' | 'webhook';
  slackUrl: string;
  webhookUrl: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  enabled: true,
  scoreThreshold: 60,
  cooldownMinutes: 360,
  channelType: 'slack',
  slackUrl: '',
  webhookUrl: '',
};

export function AlertRulesCard({ subscriptionId }: Props) {
  const qc = useQueryClient();
  const queryKey = ['manipulation-alerts', 'list', subscriptionId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      trpcClient.manipulationAlerts.listBySubscription.query({ subscriptionId }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.manipulationAlerts.create.mutate>[0]) =>
      trpcClient.manipulationAlerts.create.mutate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
  const updateMut = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.manipulationAlerts.update.mutate>[0]) =>
      trpcClient.manipulationAlerts.update.mutate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
  const deleteMut = useMutation({
    mutationFn: (ruleId: number) =>
      trpcClient.manipulationAlerts.delete.mutate({ ruleId }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  function openNew() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }
  function openEdit(rule: Rule) {
    setForm({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      scoreThreshold: rule.scoreThreshold,
      cooldownMinutes: rule.cooldownMinutes,
      channelType: rule.channel.type,
      slackUrl: rule.channel.type === 'slack' ? rule.channel.webhookUrl : '',
      webhookUrl: rule.channel.type === 'webhook' ? rule.channel.url : '',
    });
    setOpen(true);
  }

  function handleSubmit() {
    const channel =
      form.channelType === 'slack'
        ? { type: 'slack' as const, webhookUrl: form.slackUrl }
        : { type: 'webhook' as const, url: form.webhookUrl };
    if (form.id) {
      updateMut.mutate({
        ruleId: form.id,
        patch: {
          name: form.name,
          enabled: form.enabled,
          scoreThreshold: form.scoreThreshold,
          cooldownMinutes: form.cooldownMinutes,
          channel,
        },
      });
    } else {
      createMut.mutate({
        subscriptionId,
        name: form.name,
        enabled: form.enabled,
        scoreThreshold: form.scoreThreshold,
        cooldownMinutes: form.cooldownMinutes,
        channel,
      });
    }
    setOpen(false);
  }

  return (
    <Card className="m-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">알림 규칙</CardTitle>
        <Button size="sm" onClick={openNew}>+ 규칙 추가</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">로딩 중…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            이 구독에 알림 규칙이 없습니다. 임계값을 정하면 점수가 그 이상일 때 Slack/webhook으로 통보됩니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{rule.name}</span>
                  <span className="ml-3 text-muted-foreground">
                    점수 ≥ {rule.scoreThreshold} · 쿨다운 {rule.cooldownMinutes}분 ·{' '}
                    {rule.channel.type === 'slack' ? 'Slack' : 'Webhook'} ·{' '}
                    {rule.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                    편집
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`"${rule.name}" 규칙을 삭제하시겠습니까?`)) {
                        deleteMut.mutate(rule.id);
                      }
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? '규칙 편집' : '새 규칙'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>이름</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
                <Label>활성화</Label>
              </div>
              <div>
                <Label>점수 임계값 (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.scoreThreshold}
                  onChange={(e) =>
                    setForm({ ...form, scoreThreshold: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>쿨다운 (분, 1-10080)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10080}
                  value={form.cooldownMinutes}
                  onChange={(e) =>
                    setForm({ ...form, cooldownMinutes: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>채널</Label>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={form.channelType === 'slack'}
                      onChange={() => setForm({ ...form, channelType: 'slack' })}
                    />
                    Slack
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={form.channelType === 'webhook'}
                      onChange={() => setForm({ ...form, channelType: 'webhook' })}
                    />
                    Webhook
                  </label>
                </div>
              </div>
              {form.channelType === 'slack' ? (
                <div>
                  <Label>Slack webhook URL</Label>
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={form.slackUrl}
                    onChange={(e) => setForm({ ...form, slackUrl: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://example.com/hook"
                    value={form.webhookUrl}
                    onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button onClick={handleSubmit}>
                {form.id ? '저장' : '추가'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: shadcn ui 컴포넌트 부재 시 처리**

Step 1에서 발견된 누락 컴포넌트가 있다면:
- `Card/CardHeader/CardTitle/CardContent`: 없으면 `<div className="rounded border bg-card">` 등 plain Tailwind로 대체
- `Dialog`: 없으면 `Radix UI` 또는 `<dialog>` 요소
- `Switch`: 없으면 `<input type="checkbox">`
- `Label`: 없으면 `<label>` 직접 사용

대체 시 import도 함께 제거.

- [ ] **Step 4: 빌드 통과 확인**

Run: `pnpm --filter @ai-signalcraft/web typecheck`
Expected: 새 파일 관련 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/manipulation/alert-rules-card.tsx
git commit -m "feat(web): AlertRulesCard 컴포넌트 (CRUD + Editor Dialog)"
```

---

## Task 9: 구독 페이지에 카드 마운트

**Files:**
- Modify: `apps/web/src/app/subscriptions/[id]/page.tsx`

- [ ] **Step 1: 현재 manipulation 탭 구조 확인**

Run: `sed -n '20,30p' apps/web/src/app/subscriptions/[id]/page.tsx`
Expected: `import { TimeseriesView } from '@/components/manipulation/timeseries-view';` 발견.

Run: `sed -n '210,220p' apps/web/src/app/subscriptions/[id]/page.tsx`
Expected: `<TabsContent value="manipulation"><TimeseriesView subscriptionId={id} /></TabsContent>` 형태.

- [ ] **Step 2: import 추가**

기존 `TimeseriesView` import 다음에 추가:

```typescript
import { AlertRulesCard } from '@/components/manipulation/alert-rules-card';
```

- [ ] **Step 3: 탭 콘텐츠 변경**

`<TabsContent value="manipulation">` 내부의 `<TimeseriesView ... />`만 있던 구조를:

```tsx
        <TabsContent value="manipulation">
          <AlertRulesCard subscriptionId={id} />
          <TimeseriesView subscriptionId={id} />
        </TabsContent>
```

- [ ] **Step 4: typecheck + 빌드 통과 확인**

Run: `pnpm --filter @ai-signalcraft/web typecheck`
Expected: 에러 없음.

- [ ] **Step 5: 개발 서버에서 시각 확인 (수동)**

Run: `pnpm --filter @ai-signalcraft/web dev`
브라우저: `http://localhost:3000/subscriptions/37` → "조작 분석" 탭 → 카드 노출 + "+ 규칙 추가" 동작 확인.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/subscriptions/[id]/page.tsx
git commit -m "feat(web): 구독 페이지 manipulation 탭에 AlertRulesCard 마운트"
```

---

## Task 10: `.env.example` 업데이트

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 현재 파일 확인**

Run: `grep -n "BASE_URL\|APP_BASE\|NEXTAUTH_URL\|NEXT_PUBLIC" .env.example | head -10`
Expected: `NEXTAUTH_URL` 또는 비슷한 host 설정 라인 발견. 새 변수는 그 근처에 추가.

- [ ] **Step 2: APP_BASE_URL 추가**

`.env.example` 적절한 섹션(웹/공통 영역)에 추가:

```bash
# 알림 메시지의 showcase 링크 base URL.
# 미설정 시 worker는 http://localhost:3000으로 폴백 + warn 로그
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): APP_BASE_URL 추가 (manipulation 알림 링크용)"
```

---

## Task 11: 통합 검증 (수동 E2E)

> 이 task는 수동 검증 — commit 없음. 운영 측 확인이 필요한 시나리오 모음.

- [ ] **Step 1: psql로 테스트용 규칙 INSERT**

```bash
psql postgresql://postgres:postgres@192.168.0.5:5438/ai_signalcraft <<'SQL'
INSERT INTO manipulation_alert_rules
  (subscription_id, name, enabled, score_threshold, cooldown_minutes, channel)
VALUES
  (37, 'jobId=273 dryrun 트리거 확인', true, 30, 1,
   '{"type":"webhook","url":"https://webhook.site/<your-id>"}'::jsonb);
SQL
```

> webhook.site에서 일회용 URL 발급 후 사용. score_threshold=30이라 jobId=273의 score 57.21이 초과.

- [ ] **Step 2: manipulation 분석 재실행 (dryrun 또는 실제)**

Run: `pnpm --filter @ai-signalcraft/core dryrun:manipulation -- --jobId=273` (스크립트 명령은 환경에 따라 변형 가능 — `packages/core/scripts/manipulation-dryrun.ts` 참조)

또는 구독 37로 신규 분석 트리거.

- [ ] **Step 3: webhook.site에서 페이로드 도착 확인**

페이로드 안에 다음 필드 존재 확인:
- `score` ≥ 30
- `threshold` = 30
- `topSignals` (배열)
- `showcaseUrl` (정상 도메인 또는 localhost)
- `subscriptionKeyword` (또는 null)

- [ ] **Step 4: cooldown 검증**

같은 분석을 즉시 재실행 → webhook.site에 새 메시지가 오지 **않음** 확인 (cooldown 1분 미경과).

- [ ] **Step 5: cooldown 1분 후 재실행**

1분 + 약간 대기 후 재실행 → 새 메시지 도착 확인.

- [ ] **Step 6: UI에서 규칙 삭제**

`/subscriptions/37` → manipulation 탭 → 삭제 버튼 → 카드에서 row 사라짐 + DB row 삭제 확인.

- [ ] **Step 7: 정리 commit (필요 시)**

수동 검증 중 발견된 문제 수정이 있다면 별도 commit.

---

## Self-Review Checklist (작성자가 plan 확정 전 직접 검증)

- [x] **Spec coverage**: spec의 각 섹션이 어떤 task에 매핑되는지 확인
  - 데이터 모델 → Task 1
  - channels timeout → Task 2
  - evaluator → Task 3-4
  - stage5 통합 → Task 5
  - tRPC router → Task 6-7
  - UI → Task 8-9
  - 환경 변수 → Task 10
  - E2E → Task 11

- [x] **Placeholder scan**: "TBD"/"TODO"/"~비슷"/"~appropriate" 검색 → 없음

- [x] **Type consistency**:
  - `manipulationScore`는 schema에서 `real` (nullable), evaluator에서 null 체크 추가 ✓
  - `id` 컬럼: `manipulationAlertRules.id`는 integer, `manipulationRuns.id`는 uuid (string) ✓
  - `channel` discriminated union: schema/Zod/evaluator 모두 동일 모양 (`type: 'slack'|'webhook'`) ✓
  - `cooldownMinutes` 단위: integer 분, 모든 비교에서 `* 60_000` ✓
  - `subscriptionId` 타입: 모든 사용처에서 number(integer) ✓

- [x] **명령 일관성**: `pnpm --filter @ai-signalcraft/{core,web}` 형식 일관, `pnpm db:push` 루트 스크립트 사용

---

## Notes

- 모든 task 완료 후 worker 컨테이너 재시작 필요 (env 변경 때문이 아니라 stage5 코드 변경 반영) — 운영 배포 시: `dserver restart ais-prod-worker`
- `APP_BASE_URL`을 worker 컨테이너에도 추가 (Q: 메모리에 worker env drift 패턴 — duration_ms<10 에러 반복 시 재시작 필요)
- email 채널은 Phase 4 비목표. 향후 Resend 통합은 별도 spec
- 이 plan은 spec의 "테스트 — channels timeout 1케이스"를 Task 2에서 같이 처리함 (spec의 영향 라인 +6과 일치)
