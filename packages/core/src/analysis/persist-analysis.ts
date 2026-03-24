// 분석 결과 및 리포트를 DB에 저장
import { getDb } from '../db';
import { analysisResults, analysisReports } from '../db/schema/analysis';
import { sql } from 'drizzle-orm';

/**
 * 분석 모듈 결과 upsert (jobId + module unique)
 * 동일 작업+모듈 조합이 이미 있으면 결과를 업데이트
 */
export async function persistAnalysisResult(data: typeof analysisResults.$inferInsert) {
  const [result] = await getDb()
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
  return result;
}

/**
 * 종합 분석 리포트 upsert (jobId 기준)
 * 기존 리포트가 있으면 갱신, 없으면 삽입
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
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
  return report;
}
