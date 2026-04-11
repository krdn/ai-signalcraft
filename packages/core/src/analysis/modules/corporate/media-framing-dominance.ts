import {
  MediaFramingDominanceSchema,
  type MediaFramingDominanceResult,
} from '../../schemas/media-framing-dominance.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['media-framing-dominance'];

// Corporate-ADVN-03: 미디어 프레임 지배력 분석 모듈 (Entman + McCombs & Shaw)
export const mediaFramingDominanceModule: AnalysisModule<MediaFramingDominanceResult> = {
  name: 'media-framing-dominance',
  displayName: '미디어 프레임 지배력 분석',
  provider: config.provider,
  model: config.model,
  schema: MediaFramingDominanceSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('media-framing-dominance', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;
    return `당신은 미디어 프레임 분석 전문가입니다.
**Media Framing Theory (Entman, 1993)**와 **Agenda-Setting Theory (McCombs & Shaw, 1972)**를 적용하여 기업 이슈의 미디어 프레임 지배력을 분석합니다.

## 분석 중점
- Entman 3가지 프레임 유형: diagnostic(문제 정의), prognostic(해결 방향), motivational(행동 촉구)
- 어떤 미디어가 어떤 프레임을 지배하는지 매핑
- 기업의 공식 서사(official narrative)와 미디어 프레임 간 간극 측정
- 의제설정 영향력: 어느 미디어가 여론 의제를 주도하는가
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const sentimentFraming = priorResults['sentiment-framing'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const macroView = priorResults['macro-view'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const existingFrames = sentimentFraming?.frames
      ? sentimentFraming.frames
          .map((f: any) => `- ${f.frameName} (강도: ${f.strength ?? 'N/A'})`) // eslint-disable-line @typescript-eslint/no-explicit-any
          .join('\n')
      : '선행 프레임 분석 없음';

    const newsFlow = macroView?.overallTrend ?? macroView?.summary ?? '뉴스 흐름 데이터 없음';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 감정·프레임 분석 결과
${existingFrames}

## 전체 뉴스 흐름 (macro-view)
${newsFlow}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
Media Framing Theory(Entman)와 Agenda-Setting Theory(McCombs & Shaw)를 적용하여:
1. 지배적 프레임과 경합 프레임을 식별하고 점수화하세요
2. 각 프레임의 미디어 주도 매체와 의제설정 영향력을 평가하세요
3. 기업 공식 서사와 미디어 프레임 간 간극을 분석하세요
4. 프레임 전환 위험도와 관리 권고사항을 제시하세요`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (20건)
${data.comments
  .slice(0, 20)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
  .join('\n')}

---
Media Framing Theory(Entman)와 Agenda-Setting Theory(McCombs & Shaw)를 적용하여 미디어 프레임 지배력을 분석하세요.`;
  },
};
