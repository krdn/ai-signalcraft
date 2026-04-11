import {
  ReputationIndexSchema,
  type ReputationIndexResult,
} from '../../schemas/reputation-index.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['reputation-index'];

// PR/Corporate-ADVN: 브랜드/기관 평판 지수 측정 모듈
export const reputationIndexModule: AnalysisModule<ReputationIndexResult> = {
  name: 'reputation-index',
  displayName: '평판 지수 측정',
  provider: config.provider,
  model: config.model,
  schema: ReputationIndexSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('reputation-index', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 브랜드 및 기관 평판 측정 전문가입니다.
**RepTrak Model (Fombrun & van Riel, 2004)**을 기반으로 온라인 여론 데이터에서 평판 지수를 측정합니다.

## RepTrak 7개 차원 (분석 시 데이터에서 언급되는 차원 식별)
1. **제품/서비스**: 품질·혁신성·가성비에 대한 여론
2. **혁신**: 새로운 아이디어·기술·솔루션 도입 여론
3. **직장환경**: 임직원 처우·문화·고용안정 여론
4. **거버넌스**: 투명성·윤리경영·반부패 여론
5. **시민의식**: 환경·사회공헌·CSR 여론
6. **리더십**: 경영진 리더십·비전·의사결정 여론
7. **재무성과**: 수익성·성장성·안정성 여론

## 점수 기준 (0~100)
- 80~100: 매우 긍정적 평판 (업계 최고 수준)
- 60~79: 양호한 평판 (평균 이상)
- 40~59: 보통 (중립적)
- 20~39: 취약한 평판 (개선 필요)
- 0~19: 심각한 평판 위기

## Image Repair Theory 연계 (Benoit, 1997)
- 취약 차원 식별 후, 해당 차원에 맞는 이미지 회복 전략을 자연스럽게 권고에 포함
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const sentimentFraming = priorResults['sentiment-framing'] as Record<string, unknown>;
    const segmentation = priorResults['segmentation'] as Record<string, unknown>;

    const sentimentRatio = sentimentFraming?.sentimentRatio
      ? `긍정 ${Math.round((sentimentFraming.sentimentRatio.positive ?? 0) * 100)}% / 부정 ${Math.round((sentimentFraming.sentimentRatio.negative ?? 0) * 100)}% / 중립 ${Math.round((sentimentFraming.sentimentRatio.neutral ?? 0) * 100)}%`
      : '데이터 없음';

    const topFrames = [
      ...(sentimentFraming?.positiveFrames ?? []).slice(0, 2),
      ...(sentimentFraming?.negativeFrames ?? []).slice(0, 2),
    ]
      .map((f: Record<string, unknown>) => `- ${f.frame} (강도: ${f.strength})`)
      .join('\n');

    const platformData = segmentation?.platformSegments
      ? segmentation.platformSegments
          .map((p: Record<string, unknown>) => `- ${p.platform}: ${p.sentiment}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 요약
- 전반적 감정 비율: ${sentimentRatio}
- 주요 프레임들:\n${topFrames}
- 플랫폼별 반응:\n${platformData}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
RepTrak 7개 차원별로 온라인 여론에서 언급되는 차원을 식별하고 점수를 산출하세요.
종합 평판 지수와 추세, 이해관계자별 인식, 취약 지점을 분석하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
RepTrak 7개 차원별로 여론을 분류하고 종합 평판 지수를 산출하세요.`;
  },
};
