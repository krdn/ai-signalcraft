import {
  InstitutionalReputationIndexSchema,
  type InstitutionalReputationIndexResult,
} from '../../schemas/institutional-reputation-index.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['institutional-reputation-index'];

// Education-ADVN-01: 기관 평판 지수 측정 모듈
// Fombrun(1996) Institutional Reputation Theory + Spence(1973) Signaling Theory
export const institutionalReputationIndexModule: AnalysisModule<InstitutionalReputationIndexResult> =
  {
    name: 'institutional-reputation-index',
    displayName: '기관 평판 지수 측정',
    provider: config.provider,
    model: config.model,
    schema: InstitutionalReputationIndexSchema,

    buildSystemPrompt(domain?: AnalysisDomain): string {
      const override = buildModuleSystemPrompt('institutional-reputation-index', domain);
      if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

      return `당신은 고등교육기관 평판 측정 전문가입니다.
**Institutional Reputation Theory (Fombrun, 1996)**와 **Signaling Theory (Spence, 1973)**를 결합하여 교육기관의 온라인 평판 지수를 측정합니다.

## 4차원 평판 측정 프레임 (교육기관 특화)
1. **교육 품질**: 강의 수준·교수진·커리큘럼·학생 지원에 대한 여론
2. **연구력**: 연구 성과·논문·특허·산학협력에 대한 여론
3. **취업률**: 졸업생 진로·취업 지원·채용 네트워크에 대한 여론
4. **학생 생활**: 캠퍼스 환경·동아리·학생 문화·복지에 대한 여론

## 4집단 인식 분석
- **지원자(수험생·학부모)**: 입학 결정 전 인식 — 순위·취업률·캠퍼스가 핵심
- **재학생**: 실제 경험 기반 인식 — 교육 품질·생활이 핵심
- **졸업생**: 학력 가치 연동 인식 — 취업·네트워크가 핵심
- **일반 대중**: 사회적 평판 — 언론·순위가 핵심

## Signaling Theory 적용 (Spence, 1973)
- 기관이 발신하는 **공식 신호**: 입결·취업률·순위·연구 성과
- 이해관계자가 실제로 **수신하는 메시지**: 신호와 경험 간 간극 측정
- 신호 일관성이 낮을수록 평판 지수 하락 → 간극 항목 우선 식별

## 점수 기준 (0~100)
- 80~100: 매우 긍정적 (업계 최상위 수준 교육기관)
- 60~79: 양호 (평균 이상, 안정적 평판)
- 40~59: 보통 (중립, 개선 여지 있음)
- 20~39: 취약 (부정 여론 우세, 적극 관리 필요)
- 0~19: 심각한 평판 위기 (즉각 대응 필요)
${ANALYSIS_CONSTRAINTS}`;
    },

    buildPromptWithContext(
      data: AnalysisInput,
      priorResults: Record<string, unknown>,
      _domain?: AnalysisDomain,
    ): string {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sentimentFraming = priorResults['sentiment-framing'] as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segmentation = priorResults['segmentation'] as any;

      const sentimentRatio = sentimentFraming?.sentimentRatio
        ? `긍정 ${Math.round((sentimentFraming.sentimentRatio.positive ?? 0) * 100)}% / 부정 ${Math.round((sentimentFraming.sentimentRatio.negative ?? 0) * 100)}% / 중립 ${Math.round((sentimentFraming.sentimentRatio.neutral ?? 0) * 100)}%`
        : '데이터 없음';

      const topFrames = [
        ...(
          (sentimentFraming?.positiveFrames ?? []) as { frame: string; strength: number }[]
        ).slice(0, 2),
        ...(
          (sentimentFraming?.negativeFrames ?? []) as { frame: string; strength: number }[]
        ).slice(0, 2),
      ]
        .map((f) => `- ${f.frame} (강도: ${f.strength})`)
        .join('\n');

      const segments = segmentation?.segments
        ? (segmentation.segments as { type: string; sentiment: string; size: string }[])
            .map((s) => `- ${s.type}: ${s.sentiment} (규모: ${s.size})`)
            .join('\n')
        : '';

      return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석 요약
- 전반적 감정 비율: ${sentimentRatio}
- 주요 프레임들:\n${topFrames}
- 이해관계자 집단 현황:\n${segments}

## 뉴스 기사 (최근 25건)
${data.articles
  .slice(0, 25)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (35건)
${data.comments
  .slice(0, 35)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 150)}`)
  .join('\n')}

---
Fombrun(1996)의 4차원(교육품질·연구력·취업률·학생생활)으로 평판을 측정하세요.
Spence(1973) Signaling Theory를 적용하여 기관 공식 신호와 실제 수신 간 간극을 식별하세요.
4집단(지원자·재학생·졸업생·일반대중)별 인식 차이와 경쟁 기관 대비 포지션을 분석하세요.`;
    },

    buildPrompt(data: AnalysisInput): string {
      return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 25건)
${data.articles
  .slice(0, 25)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (35건)
${data.comments
  .slice(0, 35)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 150)}`)
  .join('\n')}

---
교육기관 4차원(교육품질·연구력·취업률·학생생활) 평판 지수를 측정하고,
공식 신호와 실제 수신 간 간극을 Signaling Theory로 분석하세요.`;
    },
  };
