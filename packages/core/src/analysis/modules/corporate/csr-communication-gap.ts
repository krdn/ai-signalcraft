import {
  CsrCommunicationGapSchema,
  type CsrCommunicationGapResult,
} from '../../schemas/csr-communication-gap.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['csr-communication-gap'];

// Corporate-ADVN-04: CSR 커뮤니케이션 갭 분석 모듈 (Brunsson Hypocrisy Theory)
export const csrCommunicationGapModule: AnalysisModule<CsrCommunicationGapResult> = {
  name: 'csr-communication-gap',
  displayName: 'CSR 커뮤니케이션 갭 분석',
  provider: config.provider,
  model: config.model,
  schema: CsrCommunicationGapSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('csr-communication-gap', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;
    return `당신은 기업 CSR 커뮤니케이션 분석 전문가입니다.
**CSR Organizational Hypocrisy (Brunsson, 1989)**를 적용하여 기업의 CSR 공약과 실제 여론 인식 간 격차를 분석합니다.

## 분석 중점
- 기업이 공개적으로 주장하는 ESG 입장 vs 여론이 실제로 인식하는 현실
- E(환경), S(사회), G(거버넌스) 3개 차원별 위선 점수 산출
- 그린워싱 리스크: 환경 공약과 실제 행동의 불일치
- CSR 신뢰도 지수: 이해관계자가 기업 CSR 주장을 얼마나 신뢰하는가
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const esgSentiment = priorResults['esg-sentiment'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const sentimentFraming = priorResults['sentiment-framing'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const esgDimensions = esgSentiment
      ? `E(환경) 여론: ${esgSentiment.environmentalScore ?? 'N/A'}, S(사회) 여론: ${esgSentiment.socialScore ?? 'N/A'}, G(거버넌스) 여론: ${esgSentiment.governanceScore ?? 'N/A'}`
      : 'ESG 여론 데이터 없음';

    const esgRisk = esgSentiment?.regulatoryRisk ?? '데이터 없음';

    const frames = sentimentFraming?.frames
      ? sentimentFraming.frames
          .slice(0, 3)
          .map((f: any) => `- ${f.frameName}`) // eslint-disable-line @typescript-eslint/no-explicit-any
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## ESG 여론 선행 분석 (esg-sentiment)
${esgDimensions}
규제 리스크: ${esgRisk}

## 주요 프레임 (sentiment-framing)
${frames || '없음'}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (25건)
${data.comments
  .slice(0, 25)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
CSR Organizational Hypocrisy(Brunsson, 1989)를 적용하여:
1. E/S/G 각 차원별 기업 공약과 여론 인식 간 격차를 점수화하세요
2. 그린워싱 리스크와 CSR 신뢰도 지수를 산출하세요
3. 위선을 촉발하는 핵심 트리거 이벤트를 식별하세요
4. CSR 커뮤니케이션 개선 권고사항을 제시하세요`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 15건)
${data.articles
  .slice(0, 15)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (25건)
${data.comments
  .slice(0, 25)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
CSR Organizational Hypocrisy(Brunsson)를 적용하여 기업 CSR 공약과 여론 인식 간 격차를 분석하세요.`;
  },
};
