// 분석 결과 및 리포트를 DB에 저장
import { sql, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { analysisResults, analysisReports } from '../db/schema/analysis';
import { collectionJobs } from '../db/schema/collections';
import { recordTokenUsage, recordStageDuration } from '../metrics';

/**
 * 분석 모듈 결과 upsert (jobId + module unique)
 * 동일 작업+모듈 조합이 이미 있으면 결과를 업데이트
 *
 * 취소 보호: 파이프라인이 cancelled 상태인 경우,
 * 실행 중인 모듈이 completed/running으로 덮어쓰는 것을 방지
 */
export async function persistAnalysisResult(data: typeof analysisResults.$inferInsert) {
  const db = getDb();

  // 취소 보호: 파이프라인이 cancelled 상태이면 completed/running 상태 기록 차단
  if (data.jobId && (data.status === 'completed' || data.status === 'running')) {
    const [job] = await db
      .select({ status: collectionJobs.status })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, data.jobId))
      .limit(1);
    if (job?.status === 'cancelled') {
      // 취소된 파이프라인에 completed/running 상태 기록 시도 — 무시
      return null;
    }
  }

  const [result] = await db
    .insert(analysisResults)
    .values(data)
    .onConflictDoUpdate({
      target: [analysisResults.jobId, analysisResults.module],
      set: {
        status: sql`excluded.status`,
        result: sql`excluded.result`,
        usage: sql`excluded.usage`,
        errorMessage: sql`excluded.error_message`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  // 메트릭 기록: completed 상태일 때만 토큰/stage 레이턴시 기록
  if (data.status === 'completed' && data.usage) {
    const usage = data.usage as {
      provider?: string;
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
    };
    if (usage.provider && usage.model) {
      recordTokenUsage(
        usage.provider,
        usage.model,
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
      ).catch(() => undefined);
    }
    // 모듈 단위 stage duration (createdAt → now)
    if (result?.createdAt && result?.updatedAt) {
      const dur = new Date(result.updatedAt).getTime() - new Date(result.createdAt).getTime();
      if (dur >= 0 && dur < 10 * 60 * 1000 && data.module) {
        recordStageDuration(`module:${data.module}`, dur, 'completed').catch(() => undefined);
      }
    }
  } else if (data.status === 'failed' && data.module) {
    recordStageDuration(`module:${data.module}`, 0, 'failed').catch(() => undefined);
  }

  return result;
}

/**
 * 종합 분석 리포트 upsert (jobId 기준)
 * 기존 리포트가 있으면 갱신, 없으면 삽입.
 *
 * metadata는 jsonb merge(`||`)로 갱신해 호출자가 부분 metadata를 보내도
 * 기존에 있던 다른 키(예: qualityFlags/modulesPartial — Phase 3 신호)가 사라지지 않게 한다.
 * 같은 키는 우측(excluded) 우선이라 의도된 갱신은 그대로 적용된다.
 */
export async function persistAnalysisReport(data: typeof analysisReports.$inferInsert) {
  const [report] = await getDb()
    .insert(analysisReports)
    .values(data)
    .onConflictDoUpdate({
      target: [analysisReports.jobId],
      set: {
        title: sql`excluded.title`,
        markdownContent: sql`excluded.markdown_content`,
        oneLiner: sql`excluded.one_liner`,
        metadata: sql`COALESCE(${analysisReports.metadata}, '{}'::jsonb) || COALESCE(excluded.metadata, '{}'::jsonb)`,
      },
    })
    .returning();
  return report;
}
