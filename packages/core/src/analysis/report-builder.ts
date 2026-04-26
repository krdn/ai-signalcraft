// 파이프라인 리포트 생성 — 조기 종료/정상 종료 시 리포트 빌드
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { generateIntegratedReport } from '../report/generator';
import { updateJobProgress } from '../pipeline/persist';
import { persistAnalysisReport } from './persist-analysis';
import { buildQualityMetadata, appendQualityFooterToMarkdown } from './quality-metadata';
import type { AnalysisModuleResult, AnalysisInput } from './types';

/** 조기 종료 시 결과 빌드 헬퍼 (취소/비용 한도 초과) */
export async function buildResult(
  allResults: Record<string, AnalysisModuleResult>,
  cancelledByUser: boolean,
  costLimitExceeded: boolean,
  input: AnalysisInput,
) {
  const completedModules = Object.values(allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const failedModules = Object.values(allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  const reason = cancelledByUser ? '사용자에 의해 중지됨' : '비용 한도 초과로 중지됨';
  let report: { markdownContent: string; oneLiner: string; totalTokens: number };

  if (completedModules.length > 0) {
    await updateJobProgress(input.jobId, { report: { status: 'running' } });
    try {
      report = await generateIntegratedReport({
        jobId: input.jobId,
        keyword: input.keyword,
        dateRange: input.dateRange,
        results: allResults,
        completedModules,
        failedModules,
        domain: input.domain,
      });
      await updateJobProgress(input.jobId, { report: { status: 'completed' } });
    } catch {
      await updateJobProgress(input.jobId, { report: { status: 'failed' } });
      const fallbackMd = `# ${input.keyword} 분석 리포트 (부분)\n\n> ${reason}\n\n완료된 모듈: ${completedModules.join(', ') || '없음'}`;
      report = { markdownContent: fallbackMd, oneLiner: reason, totalTokens: 0 };
      await saveFallbackReport(input, fallbackMd, reason, completedModules, failedModules);
    }
  } else {
    const noModuleMd = `# ${input.keyword} 분석 리포트\n\n> ${reason}\n\n완료된 모듈이 없습니다.`;
    report = { markdownContent: noModuleMd, oneLiner: reason, totalTokens: 0 };
    await saveFallbackReport(input, noModuleMd, reason, [], failedModules);
  }

  return {
    results: allResults,
    completedModules,
    failedModules,
    report,
    cancelledByUser,
    costLimitExceeded,
  };
}

/** 정상 종료 시 리포트 생성 (모든 Stage 완료 후) */
export async function generateFinalReport(
  allResults: Record<string, AnalysisModuleResult>,
  input: AnalysisInput,
): Promise<{ markdownContent: string; oneLiner: string; totalTokens: number }> {
  const completedModules = Object.values(allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const failedModules = Object.values(allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  console.log(
    `[pipeline] 리포트 생성 시작: 완료 ${completedModules.length}개, 실패 ${failedModules.length}개 모듈`,
  );
  await updateJobProgress(input.jobId, { report: { status: 'running' } });

  try {
    const report = await generateIntegratedReport({
      jobId: input.jobId,
      keyword: input.keyword,
      dateRange: input.dateRange,
      results: allResults,
      completedModules,
      failedModules,
      domain: input.domain,
    });
    await updateJobProgress(input.jobId, { report: { status: 'completed' } });
    return report;
  } catch (reportError) {
    console.error('리포트 생성 실패 (부분 결과로 계속 진행):', reportError);
    await updateJobProgress(input.jobId, { report: { status: 'failed' } });
    const fallbackMarkdown = `# ${input.keyword} 분석 리포트\n\n> 리포트 자동 생성에 실패했습니다. 개별 모듈 분석 결과를 확인하세요.\n\n## 완료된 모듈\n${completedModules.map((m) => `- ${m}`).join('\n')}\n\n## 실패한 모듈\n${failedModules.map((m) => `- ${m}`).join('\n')}`;
    const fallbackOneLiner = '리포트 생성 실패 -- 개별 모듈 결과 참조';
    await saveFallbackReport(
      input,
      fallbackMarkdown,
      fallbackOneLiner,
      completedModules,
      failedModules,
    );
    return { markdownContent: fallbackMarkdown, oneLiner: fallbackOneLiner, totalTokens: 0 };
  }
}

/** fallback 리포트 DB 저장 */
async function saveFallbackReport(
  input: AnalysisInput,
  markdownContent: string,
  oneLiner: string,
  completedModules: string[],
  failedModules: string[],
) {
  try {
    // Phase 3: fallback 경로에서도 progress._events에서 부분 실패/얕은 표본 신호를 추출해
    //          metadata + markdown footer에 반영. (정상 보고서 경로의 generator.ts와 동일 정책)
    let qualityMeta;
    try {
      const [jobRow] = await getDb()
        .select({ progress: collectionJobs.progress })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId))
        .limit(1);
      qualityMeta = buildQualityMetadata(jobRow?.progress as Record<string, unknown> | null);
    } catch {
      qualityMeta = buildQualityMetadata(null);
    }
    const finalMarkdown = appendQualityFooterToMarkdown(markdownContent, qualityMeta);

    await persistAnalysisReport({
      jobId: input.jobId,
      title: `${input.keyword} 종합 분석 리포트`,
      markdownContent: finalMarkdown,
      oneLiner,
      metadata: {
        keyword: input.keyword,
        dateRange: {
          start: new Date(input.dateRange.start).toISOString(),
          end: new Date(input.dateRange.end).toISOString(),
        },
        modulesCompleted: completedModules,
        modulesFailed: failedModules,
        totalTokens: 0,
        generatedAt: new Date().toISOString(),
        modulesPartial: qualityMeta.modulesPartial,
        warnings: qualityMeta.warnings,
        qualityFlags: qualityMeta.qualityFlags,
      },
    });
  } catch (e) {
    console.error('fallback 리포트 DB 저장 실패:', e);
  }
}
