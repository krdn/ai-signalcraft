// 알림 평가 엔진 — 분석 완료 후 규칙 검사 및 이벤트 생성
import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db';
import { alertRules, alertEvents } from '../db/schema/alerts';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
import { createLogger } from '../utils/logger';
import { sendNotification, type AlertChannel } from './channels';

const log = createLogger('alerts:evaluator');

type TriggerType = 'sentiment_shift' | 'risk_spike' | 'volume_anomaly' | 'keyword';

interface TriggerResult {
  triggered: boolean;
  triggerType: TriggerType;
  message: string;
  data: Record<string, unknown>;
}

/**
 * 분석 완료 후 활성화된 알림 규칙을 평가하고, 조건 충족 시 알림 이벤트 생성
 * 파이프라인에서 비차단(fire-and-forget)으로 호출됨
 */
export async function evaluateAlerts(
  jobId: number,
  results: Record<string, unknown>,
): Promise<void> {
  log.info(`알림 평가 시작: jobId=${jobId}`);

  // 1. 활성화된 모든 알림 규칙 로드
  const rules = await getDb().select().from(alertRules).where(eq(alertRules.enabled, true));

  if (rules.length === 0) {
    log.info('활성화된 알림 규칙 없음');
    return;
  }

  log.info(`평가할 규칙: ${rules.length}개`);

  // 2. 현재 job 정보 조회 (이전 run 비교용 keyword 필요)
  const [jobRow] = await getDb()
    .select({ keyword: collectionJobs.keyword, userId: collectionJobs.userId })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!jobRow) {
    log.warn(`jobId=${jobId} 조회 실패 — 알림 평가 중단`);
    return;
  }

  // 3. 각 규칙 평가
  for (const rule of rules) {
    const conditions = rule.conditions as {
      sentimentShiftThreshold?: number;
      riskScoreThreshold?: number;
      volumeAnomaly?: number;
      keywords?: string[];
    };

    try {
      const triggers: TriggerResult[] = [];

      // 3a. 감성 변화 임계값 검사
      if (conditions.sentimentShiftThreshold !== undefined) {
        const trigger = await checkSentimentShift(
          jobId,
          jobRow.keyword,
          results,
          conditions.sentimentShiftThreshold,
        );
        if (trigger) triggers.push(trigger);
      }

      // 3b. 리스크 점수 임계값 검사
      if (conditions.riskScoreThreshold !== undefined) {
        const trigger = checkRiskScore(results, conditions.riskScoreThreshold);
        if (trigger) triggers.push(trigger);
      }

      // 3c. 볼륨 이상 징후 검사
      if (conditions.volumeAnomaly !== undefined) {
        const trigger = checkVolumeAnomaly(results, conditions.volumeAnomaly);
        if (trigger) triggers.push(trigger);
      }

      // 3d. 키워드 출현 검사
      if (conditions.keywords && conditions.keywords.length > 0) {
        const trigger = checkKeywordPresence(results, conditions.keywords);
        if (trigger) triggers.push(trigger);
      }

      // 4. 트리거된 알림 이벤트 생성 + 채널 전송
      for (const t of triggers) {
        log.info(`규칙 "${rule.name}" 트리거: ${t.triggerType} — ${t.message}`);

        // 이벤트 DB 저장
        await getDb().insert(alertEvents).values({
          ruleId: rule.id,
          jobId,
          triggerType: t.triggerType,
          message: t.message,
          data: t.data,
        });

        // 규칙 lastTriggeredAt 업데이트
        await getDb()
          .update(alertRules)
          .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
          .where(eq(alertRules.id, rule.id));

        // 채널 알림 전송
        const channels = rule.channels as Record<string, unknown>;
        if (channels.email) {
          await sendNotification({ email: true } as AlertChannel, t.message, {
            ...t.data,
            triggerType: t.triggerType,
            ruleName: rule.name,
          });
        }
        if (channels.slack && typeof channels.slack === 'object') {
          const slack = channels.slack as { webhookUrl: string };
          await sendNotification(
            { slack: { webhookUrl: slack.webhookUrl } } as AlertChannel,
            t.message,
            { ...t.data, triggerType: t.triggerType, ruleName: rule.name },
          );
        }
        if (channels.webhook && typeof channels.webhook === 'object') {
          const webhook = channels.webhook as { url: string; headers?: Record<string, string> };
          await sendNotification(
            { webhook: { url: webhook.url, headers: webhook.headers } } as AlertChannel,
            t.message,
            { ...t.data, triggerType: t.triggerType, ruleName: rule.name },
          );
        }
      }
    } catch (err) {
      log.error(`규칙 "${rule.name}" 평가 실패:`, err);
    }
  }

  log.info('알림 평가 완료');
}

/**
 * 감성 변화 임계값 검사
 * 현재 run의 감성 비율과 이전 run의 감성 비율을 비교하여 delta가 임계값 초과 시 트리거
 */
async function checkSentimentShift(
  jobId: number,
  keyword: string,
  results: Record<string, unknown>,
  threshold: number,
): Promise<TriggerResult | null> {
  // 현재 분석에서 감성 비율 추출
  const sentimentResult = extractSentimentRatio(results);
  if (!sentimentResult) return null;

  const { positive, negative, neutral } = sentimentResult;

  // 이전 완료된 job의 감성 결과 조회
  const previousJobs = await getDb()
    .select({ id: collectionJobs.id })
    .from(collectionJobs)
    .where(and(eq(collectionJobs.keyword, keyword), eq(collectionJobs.status, 'completed')))
    .orderBy(desc(collectionJobs.id))
    .limit(2);

  // 자기 자신(jobId) 이외의 가장 최근 job 찾기
  const previousJob = previousJobs.find((j) => j.id !== jobId);
  if (!previousJob) return null; // 비교할 이전 데이터 없음

  // 이전 job의 분석 결과에서 감성 데이터 조회
  const [prevAnalysis] = await getDb()
    .select({ result: analysisResults.result })
    .from(analysisResults)
    .where(
      and(
        eq(analysisResults.jobId, previousJob.id),
        eq(analysisResults.module, 'sentiment-framing'),
      ),
    )
    .limit(1);

  if (!prevAnalysis?.result) return null;

  const prevSentiment = extractSentimentRatioFromModule(
    prevAnalysis.result as Record<string, unknown>,
  );
  if (!prevSentiment) return null;

  // 긍정/부정 비율 변화량 계산
  const positiveDelta = Math.abs(positive - prevSentiment.positive);
  const negativeDelta = Math.abs(negative - prevSentiment.negative);
  const maxDelta = Math.max(positiveDelta, negativeDelta);

  if (maxDelta > threshold) {
    return {
      triggered: true,
      triggerType: 'sentiment_shift',
      message: `감성 변화 감지: 긍정 ${prevSentiment.positive.toFixed(1)}% → ${positive.toFixed(1)}%, 부정 ${prevSentiment.negative.toFixed(1)}% → ${negative.toFixed(1)}% (변화 ${maxDelta.toFixed(1)}%p, 임계값 ${threshold}%)`,
      data: {
        currentSentiment: { positive, negative, neutral },
        previousSentiment: prevSentiment,
        delta: maxDelta,
        threshold,
        previousJobId: previousJob.id,
      },
    };
  }

  return null;
}

/**
 * 리스크 점수 임계값 검사
 * risk-map 모듈 결과에서 overall risk score 확인
 */
function checkRiskScore(results: Record<string, unknown>, threshold: number): TriggerResult | null {
  const riskResult = getModuleResult(results, 'risk-map');
  if (!riskResult) return null;

  // risk-map 결과에서 overallScore 또는 riskScore 필드 확인
  const overallScore =
    (riskResult.overallScore as number) ??
    (riskResult.riskScore as number) ??
    (riskResult.overall_risk_score as number);

  if (overallScore === undefined || overallScore === null) return null;

  if (overallScore > threshold) {
    return {
      triggered: true,
      triggerType: 'risk_spike',
      message: `리스크 점수 급등: ${overallScore} (임계값 ${threshold})`,
      data: {
        riskScore: overallScore,
        threshold,
        riskDetails: riskResult,
      },
    };
  }

  return null;
}

/**
 * 볼륨 이상 징후 검사
 * macroView 결과의 dailyMentionTrend에서 평균 대비 급증 여부 확인
 */
function checkVolumeAnomaly(
  results: Record<string, unknown>,
  stdDevThreshold: number,
): TriggerResult | null {
  const macroResult = getModuleResult(results, 'macro-view');
  if (!macroResult) return null;

  const trend = macroResult.dailyMentionTrend as Array<Record<string, unknown>> | undefined;

  if (!trend || !Array.isArray(trend) || trend.length < 3) return null;

  const counts = trend.map((d) => (d.count as number) || 0).filter((c) => c > 0);

  if (counts.length < 3) return null;

  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const stdDev = Math.sqrt(
    counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length,
  );

  if (stdDev === 0) return null;

  const latestCount = counts[counts.length - 1];
  const zScore = (latestCount - mean) / stdDev;

  if (zScore > stdDevThreshold) {
    return {
      triggered: true,
      triggerType: 'volume_anomaly',
      message: `언급량 급증 감지: 최근 ${latestCount}건 (평균 ${mean.toFixed(1)}건, ${zScore.toFixed(1)}σ, 임계값 ${stdDevThreshold}σ)`,
      data: {
        latestCount,
        mean,
        stdDev,
        zScore,
        threshold: stdDevThreshold,
        trendSample: trend.slice(-5),
      },
    };
  }

  return null;
}

/**
 * 키워드 출현 검사
 * messageImpact/segmentation 결과에서 지정 키워드 출현 여부 확인
 */
function checkKeywordPresence(
  results: Record<string, unknown>,
  keywords: string[],
): TriggerResult | null {
  const messageResult = getModuleResult(results, 'message-impact');
  const segResult = getModuleResult(results, 'segmentation');

  // 결과 텍스트를 합쳐서 키워드 검색
  const combinedText = JSON.stringify({
    message: messageResult,
    segmentation: segResult,
  }).toLowerCase();

  const matchedKeywords = keywords.filter((kw) => combinedText.includes(kw.toLowerCase()));

  if (matchedKeywords.length > 0) {
    return {
      triggered: true,
      triggerType: 'keyword',
      message: `키워드 감지: ${matchedKeywords.join(', ')}`,
      data: {
        matchedKeywords,
        allKeywords: keywords,
      },
    };
  }

  return null;
}

// --- 헬퍼 함수 ---

/** 분석 결과에서 모듈 결과 추출 */
function getModuleResult(
  results: Record<string, unknown>,
  moduleName: string,
): Record<string, unknown> | null {
  // results가 AnalysisModuleResult 래퍼인 경우 (status/module/result 구조)
  const moduleResult = results[moduleName] as
    | { status?: string; result?: unknown; module?: string }
    | undefined;

  if (!moduleResult) return null;

  if (moduleResult.status === 'completed' && moduleResult.result) {
    return moduleResult.result as Record<string, unknown>;
  }

  // 직접 결과인 경우
  if (moduleResult.status === undefined) {
    return moduleResult as Record<string, unknown>;
  }

  return null;
}

/** 전체 분석 결과에서 감성 비율 추출 */
function extractSentimentRatio(
  results: Record<string, unknown>,
): { positive: number; negative: number; neutral: number } | null {
  const sentimentData = getModuleResult(results, 'sentiment-framing');
  if (!sentimentData) return null;
  return extractSentimentRatioFromModule(sentimentData);
}

/** 모듈 결과에서 감성 비율 추출 */
function extractSentimentRatioFromModule(
  moduleResult: Record<string, unknown>,
): { positive: number; negative: number; neutral: number } | null {
  const positive =
    (moduleResult.positiveRatio as number) ??
    (moduleResult.positive_ratio as number) ??
    (moduleResult.positivePercent as number);

  const negative =
    (moduleResult.negativeRatio as number) ??
    (moduleResult.negative_ratio as number) ??
    (moduleResult.negativePercent as number);

  const neutral =
    (moduleResult.neutralRatio as number) ??
    (moduleResult.neutral_ratio as number) ??
    (moduleResult.neutralPercent as number);

  if (positive === undefined && negative === undefined) return null;

  return {
    positive: positive ?? 0,
    negative: negative ?? 0,
    neutral: neutral ?? 0,
  };
}
