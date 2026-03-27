// 통합 리포트 마크다운 생성기 (D-04 2단계)
import { analyzeText } from '@ai-signalcraft/ai-gateway';
import { persistAnalysisReport } from '../analysis/persist-analysis';
import { getModuleModelConfig } from '../analysis/model-config';
import type { AnalysisModuleResult } from '../analysis/types';
import type { ReportGenerationInput } from '../types/report';

export type { ReportGenerationInput } from '../types/report';

// 고급 분석(ADVN) 모듈 결과가 있으면 프롬프트에 추가할 섹션 생성
const ADVN_MODULES = ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'];

function buildAdvancedAnalysisSection(input: ReportGenerationInput): string {
  const advnResults = Object.entries(input.results)
    .filter(([k, r]) => ADVN_MODULES.includes(k) && r.status === 'completed');

  if (advnResults.length === 0) return '';

  return `

## 고급 분석 결과
다음 고급 분석 모듈 결과도 리포트에 자연스럽게 통합하세요:
${advnResults.map(([k, r]) => `### ${k}\n${JSON.stringify(r.result, null, 2)}`).join('\n\n')}

고급 분석 섹션에서는:
- AI 지지율 추정 결과에 면책 문구를 반드시 포함
- 프레임 전쟁 분석의 시각적 구조(지배적 vs 위협 vs 반전 가능)
- 위기 시나리오 3개를 표 형태로 정리
- 승리 확률과 핵심 전략을 명확히 구분`;
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
        .map(([k, r]) => [k, r.result])
    ),
    null,
    2,
  );

  // 누락 섹션 명시
  const failedSection = input.failedModules.length > 0
    ? `\n\n> **주의:** 다음 분석 모듈이 실패하여 해당 섹션은 포함되지 않았습니다: ${input.failedModules.join(', ')}`
    : '';

  // final-summary 결과에서 oneLiner 추출
  const finalSummaryResult = input.results['final-summary'];
  const oneLiner = (finalSummaryResult?.status === 'completed' && finalSummaryResult?.result)
    ? (finalSummaryResult.result as any).oneLiner ?? ''
    : '';

  const config = await getModuleModelConfig('integrated-report');

  const prompt = `당신은 정치·여론·미디어 전략 보고서를 작성하는 최고 수준의 데이터 전략가입니다.

아래의 분석 결과 데이터를 기반으로 **종합 전략 리포트**를 마크다운 형식으로 작성하세요.

## 리포트 정보
- 분석 대상: ${input.keyword}
- 분석 기간: ${input.dateRange.start.toISOString().split('T')[0]} ~ ${input.dateRange.end.toISOString().split('T')[0]}

## 분석 결과 데이터
${resultsJson}

## 작성 지침
1. **핵심 -> 분석 -> 전략** 순서로 작성
2. 각 섹션에 해당하는 분석 모듈 결과를 자연어로 풀어서 설명
3. 섹션 구조:
   - # 종합 분석 리포트: [키워드]
   - ## 한 줄 요약 (final-summary의 oneLiner 활용)
   - ## 1. 전체 여론 구조 (macro-view 결과)
   - ## 2. 집단별 반응 분석 (segmentation 결과)
   - ## 3. 감정 및 프레임 분석 (sentiment-framing 결과)
   - ## 4. 메시지 효과 분석 (message-impact 결과)
   - ## 5. 리스크 분석 (risk-map 결과)
   - ## 6. 기회 분석 (opportunity 결과)
   - ## 7. 전략 도출 (strategy 결과)
   - ## 8. 최종 전략 요약 (final-summary 결과)
4. 전략 중심으로 작성, 단순 요약 금지
5. 근거 없는 추측 금지${failedSection}${buildAdvancedAnalysisSection(input)}`;

  const result = await analyzeText(prompt, {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    systemPrompt: '당신은 정치·여론·미디어 전략을 설계하는 최고 수준의 데이터 전략가이자 선거 캠프 수석 분석관입니다. 단순 요약이 아니라, 실제 의사결정자가 즉시 전략을 실행할 수 있는 수준의 분석 보고서를 작성합니다.',
    maxOutputTokens: 16384,
  });

  const markdownContent = result.text;

  // 총 토큰 계산: 모듈별 토큰 + 리포트 생성 토큰
  const moduleTokens = Object.values(input.results)
    .filter(r => r.usage)
    .reduce((sum, r) => sum + (r.usage?.totalTokens ?? 0), 0);
  const reportTokens = (result.usage as any)?.totalTokens ?? 0;
  const totalTokens = moduleTokens + reportTokens;

  // DB에 리포트 저장
  await persistAnalysisReport({
    jobId: input.jobId,
    title: `${input.keyword} 종합 분석 리포트`,
    markdownContent,
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
      generatedAt: new Date().toISOString(),
    },
  });

  return { markdownContent, oneLiner, totalTokens };
}
