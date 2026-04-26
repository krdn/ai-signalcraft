// 통합 리포트 마크다운 생성기 (D-04 2단계)
import { analyzeText } from '@krdn/ai-analysis-kit/gateway';
import { eq } from 'drizzle-orm';
import { persistAnalysisReport } from '../analysis/persist-analysis';
import { getModuleModelConfig } from '../analysis/model-config';
import { buildQualityMetadata, appendQualityFooterToMarkdown } from '../analysis/quality-metadata';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import type { ReportGenerationInput } from '../types/report';
import type { AnalysisDomain } from '../analysis/domain';
import { getDomainConfig, getSupportedDomains } from '../analysis/domain';

export type { ReportGenerationInput } from '../types/report';

/** 모든 도메인의 Stage 4 모듈명을 동적으로 수집 */
function getAllAdvnModuleNames(): Set<string> {
  const names = new Set<string>();
  for (const domain of getSupportedDomains()) {
    const config = getDomainConfig(domain);
    for (const m of [...config.stage4.parallel, ...config.stage4.sequential]) {
      names.add(m);
    }
  }
  return names;
}

function buildAdvancedAnalysisSection(input: ReportGenerationInput): string {
  const advnModuleNames = getAllAdvnModuleNames();
  const advnResults = Object.entries(input.results).filter(
    ([k, r]) => advnModuleNames.has(k) && r.status === 'completed',
  );

  if (advnResults.length === 0) return '';

  return `

## 고급 분석 결과
다음 고급 분석 모듈 결과도 리포트에 자연스럽게 통합하세요:
${advnResults.map(([k, r]) => `### ${k}\n${JSON.stringify(r.result, null, 2)}`).join('\n\n')}`;
}

/**
 * 모든 모듈 결과를 AI에 넘겨 자연어 종합 리포트 생성
 * - 완료된 모듈 결과만 JSON으로 직렬화하여 프롬프트에 포함
 * - 실패한 모듈은 누락 섹션으로 명시
 * - final-summary의 oneLiner를 추출
 * - 생성된 리포트를 DB에 저장
 */
export async function generateIntegratedReport(input: ReportGenerationInput): Promise<{
  markdownContent: string;
  oneLiner: string;
  totalTokens: number;
}> {
  // 완료된 모듈 결과만 추출하여 직렬화
  const resultsJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(input.results)
        .filter(([_, r]) => r.status === 'completed')
        .map(([k, r]) => [k, r.result]),
    ),
    null,
    2,
  );

  // 누락 섹션 명시
  const failedSection =
    input.failedModules.length > 0
      ? `\n\n> **주의:** 다음 분석 모듈이 실패하여 해당 섹션은 포함되지 않았습니다: ${input.failedModules.join(', ')}`
      : '';

  // final-summary 결과에서 oneLiner 추출
  const finalSummaryResult = input.results['final-summary'];
  const oneLiner =
    finalSummaryResult?.status === 'completed' && finalSummaryResult?.result
      ? ((finalSummaryResult.result as any).oneLiner ?? '')
      : '';

  const config = await getModuleModelConfig('integrated-report');

  // 도메인 설정 로드
  const domain: AnalysisDomain = (input as any).domain ?? 'political';
  const domainConfig = getDomainConfig(domain);

  const prompt = `당신은 ${domainConfig.displayName} 종합 전략 보고서를 작성하는 최고 수준의 데이터 전략가입니다.

아래의 분석 결과 데이터를 기반으로 **종합 전략 리포트**를 마크다운 형식으로 작성하세요.

## 리포트 정보
- 분석 대상: ${input.keyword}
- 분석 기간: ${input.dateRange.start.toISOString().split('T')[0]} ~ ${input.dateRange.end.toISOString().split('T')[0]}

## 분석 결과 데이터
${resultsJson}

## 작성 지침
1. **핵심 -> 분석 -> 전략** 순서로 작성
2. 각 섹션에 해당하는 분석 모듈 결과를 자연어로 풀어서 설명
3. 섹션 구조:${domainConfig.reportSectionTemplate}
4. 전략 중심으로 작성, 단순 요약 금지
5. 근거 없는 추측 금지
6. **헤딩 규칙 (반드시 준수)**: 각 섹션 제목은 반드시 ## (h2) 레벨로 작성하세요. ### (h3) 레벨은 섹션 내부 소제목에만 사용합니다.${failedSection}${buildAdvancedAnalysisSection(input)}`;

  const result = await analyzeText(prompt, {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    systemPrompt:
      domainConfig.reportSystemPrompt +
      ' 단순 요약이 아니라, 실제 의사결정자가 즉시 전략을 실행할 수 있는 수준의 분석 보고서를 작성합니다.',
    maxOutputTokens: 16384,
  });

  const markdownContent = result.text;

  // 총 토큰 계산: 모듈별 토큰 + 리포트 생성 토큰
  const moduleTokens = Object.values(input.results)
    .filter((r) => r.usage)
    .reduce((sum, r) => sum + (r.usage?.totalTokens ?? 0), 0);
  const reportTokens = (result.usage as any)?.totalTokens ?? 0;
  const totalTokens = moduleTokens + reportTokens;

  // Phase 3: 부분 실패·얕은 표본 신호를 metadata + footer에 노출
  //          (job 271 사례 — completed인데 부분 실패 가시성 부재 결함 수정)
  let qualityMeta;
  try {
    const [jobRow] = await getDb()
      .select({ progress: collectionJobs.progress })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, input.jobId))
      .limit(1);
    qualityMeta = buildQualityMetadata(jobRow?.progress as Record<string, unknown> | null);
  } catch {
    // progress 조회 실패는 보고서 생성을 막지 않음
    qualityMeta = buildQualityMetadata(null);
  }
  const finalMarkdown = appendQualityFooterToMarkdown(markdownContent, qualityMeta);

  // DB에 리포트 저장
  await persistAnalysisReport({
    jobId: input.jobId,
    title: `${input.keyword} 종합 분석 리포트`,
    markdownContent: finalMarkdown,
    oneLiner,
    metadata: {
      keyword: input.keyword,
      dateRange: {
        start: input.dateRange.start.toISOString(),
        end: input.dateRange.end.toISOString(),
      },
      modulesCompleted: input.completedModules,
      modulesFailed: input.failedModules,
      totalTokens,
      reportModel: { provider: config.provider, model: config.model },
      generatedAt: new Date().toISOString(),
      // === Phase 3 신규 필드 ===
      modulesPartial: qualityMeta.modulesPartial,
      warnings: qualityMeta.warnings,
      qualityFlags: qualityMeta.qualityFlags,
    },
  });

  return { markdownContent: finalMarkdown, oneLiner, totalTokens };
}
