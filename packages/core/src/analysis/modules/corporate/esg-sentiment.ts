import { EsgSentimentSchema, type EsgSentimentResult } from '../../schemas/esg-sentiment.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['esg-sentiment'];

// Corporate/Retail-ADVN: ESG 차원별 여론 분석 모듈
export const esgSentimentModule: AnalysisModule<EsgSentimentResult> = {
  name: 'esg-sentiment',
  displayName: 'ESG 여론 분석',
  provider: config.provider,
  model: config.model,
  schema: EsgSentimentSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('esg-sentiment', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 ESG(환경·사회·지배구조) 여론 분석 전문가입니다.
온라인 여론 데이터에서 **ESG 3차원별로 기업/기관에 대한 여론**을 분석합니다.

## ESG 3차원 분류 기준

### E (Environmental — 환경)
- 탄소 배출·기후 대응 여론
- 환경 오염·생태계 영향 논란
- 재생에너지·친환경 경영 평가

### S (Social — 사회)
- 임직원 처우·노사 관계
- 다양성·포용성·인권 경영
- 지역사회 공헌·소비자 보호

### G (Governance — 지배구조)
- 경영 투명성·반부패
- 이사회 독립성·주주 권리
- 내부 통제·공시 신뢰성

## 분석 원칙
- ESG 관련 언급이 없는 경우 "데이터 부족"으로 표시하세요
- 규제기관의 조사·경고는 높은 규제 리스크 신호로 처리
- ESG 관련 허위 사실이나 그린워싱 논란도 별도 표시
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const sentimentFraming = priorResults['sentiment-framing'] as Record<string, unknown>;
    const topKeywords = sentimentFraming?.topKeywords
      ? sentimentFraming.topKeywords
          .slice(0, 15)
          .map((k: any) => `${k.keyword}(${k.sentiment})`)
          .join(', ')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 상위 키워드 (감정 포함)
${topKeywords}

## 뉴스 기사 (최근 25건)
${data.articles
  .slice(0, 25)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
위 데이터에서 ESG 관련 언급을 E·S·G 3차원으로 분류하고 각 차원의 여론 점수와 주요 이슈를 도출하세요.
ESG 관련 언급이 없는 차원은 점수 50(중립)으로 처리하고 데이터 부족을 명시하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 25건)
${data.articles
  .slice(0, 25)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
ESG 3차원별로 여론을 분류하고 각 차원의 점수와 주요 이슈를 도출하세요.`;
  },
};
