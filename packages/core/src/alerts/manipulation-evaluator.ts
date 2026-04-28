import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import {
  manipulationAlertRules,
  manipulationRuns,
  manipulationSignals,
} from '../db/schema/manipulation';
import { getCollectorClient } from '../collector-client';
import { createLogger } from '../utils/logger';
import { sendNotification, type AlertChannel } from './channels';

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
      const sub = await getCollectorClient().subscriptions.get.query({
        id: input.subscriptionId,
      });
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
