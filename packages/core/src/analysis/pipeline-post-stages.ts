// 분석 파이프라인 — Stage 5(manipulation) 이후 후처리 단계
//
// 모든 후처리는 비차단 (실패해도 파이프라인 결과에 영향 없음):
//   1. 온톨로지 추출 + 영속화
//   2. 시리즈 델타 분석
//   3. 사용자 알림 규칙 평가
//
// pipeline-orchestrator.ts에서 분리 — 메인 흐름의 가독성을 위해.
import { eq } from 'drizzle-orm';
import { evaluateAlerts } from '../alerts';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { logError } from '../utils/logger';
import { appendJobEvent } from '../pipeline/persist';
import { extractEntitiesFromResults } from './ontology-extractor';
import { persistOntology } from './persist-ontology';
import { runSeriesDeltaAnalysis } from './delta';
import { runStage5Manipulation } from './manipulation';
import type { AnalysisModuleResult } from './types';

/**
 * Stage 5: Manipulation Detection (옵션, 비차단)
 *   - default OFF: jobOptions.runManipulation === true 일 때만 실행
 *   - 구독 경로 한정: subscriptionId 없으면 SKIP
 *   - dateRange는 collectionJobs.startDate/endDate (분석 데이터 윈도우, 실행 시각이 아님)
 *   - 취소/비용 초과 시 SKIP (취소된 잡에 collector RTT 낭비 방지)
 */
export async function runStage5IfEnabled(params: {
  jobId: number;
  jobOptions: Record<string, unknown>;
  domain: string | undefined;
  cancelledByUser: boolean;
  costLimitExceeded: boolean;
}): Promise<void> {
  const { jobId, jobOptions, domain, cancelledByUser, costLimitExceeded } = params;
  if (cancelledByUser || costLimitExceeded) return;

  try {
    const [windowRow] = await getDb()
      .select({ startDate: collectionJobs.startDate, endDate: collectionJobs.endDate })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (windowRow?.startDate && windowRow?.endDate) {
      await runStage5Manipulation({
        jobId,
        jobOptions,
        domain: domain ?? 'political',
        dateRange: { start: windowRow.startDate, end: windowRow.endDate },
      });
    } else {
      logError('manipulation-stage5', new Error(`jobId ${jobId}: startDate/endDate 누락`));
    }
  } catch (err) {
    logError('manipulation-stage5', err);
  }
}

/**
 * 분석 완료 후 비차단 후처리 — 실패는 로그만 남기고 계속 진행.
 */
export async function runPostAnalysisStages(
  jobId: number,
  allResults: Record<string, AnalysisModuleResult>,
): Promise<void> {
  // 온톨로지 추출 (비차단)
  try {
    const completedResultMap: Record<string, { status: string; result?: unknown }> = {};
    for (const [key, val] of Object.entries(allResults)) {
      if (val.status === 'completed') {
        completedResultMap[key] = val;
      }
    }
    const { entities: extractedEntities, relations: extractedRelations } =
      extractEntitiesFromResults(completedResultMap);
    if (extractedEntities.length > 0) {
      const stats = await persistOntology(jobId, extractedEntities, extractedRelations);
      await appendJobEvent(
        jobId,
        'info',
        `온톨로지 추출 완료: 엔티티 ${stats.entityCount}개, 관계 ${stats.relationCount}개`,
      );
    }
  } catch (e) {
    console.error('[ontology] 추출 실패:', e);
  }

  // 시리즈에 속한 job이면 델타 분석 실행 (비차단)
  try {
    const [jobRow] = await getDb()
      .select({ seriesId: collectionJobs.seriesId })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (jobRow?.seriesId) {
      await runSeriesDeltaAnalysis(jobRow.seriesId, jobId);
    }
  } catch (e) {
    console.error('[delta] 델타 분석 실패:', e);
  }

  // 알림 규칙 평가 — 사용자 정의 임계값 검사 후 알림 전송 (비차단)
  evaluateAlerts(jobId, allResults as unknown as Record<string, unknown>).catch((err) =>
    logError('alerts', err),
  );
}
