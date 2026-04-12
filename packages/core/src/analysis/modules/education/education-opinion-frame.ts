import {
  EducationOpinionFrameSchema,
  type EducationOpinionFrameResult,
} from '../../schemas/education-opinion-frame.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['education-opinion-frame'];

// Education-ADVN-02: 교육 여론 프레임 분석 모듈
// Signaling Theory(Spence, 1973) + Rankings Dynamics(Espeland & Sauder, 2007)
export const educationOpinionFrameModule: AnalysisModule<EducationOpinionFrameResult> = {
  name: 'education-opinion-frame',
  displayName: '교육 여론 프레임 분석',
  provider: config.provider,
  model: config.model,
  schema: EducationOpinionFrameSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('education-opinion-frame', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 교육기관 담론 역학 분석 전문가입니다.
**Rankings and Reputation Dynamics (Espeland & Sauder, 2007)**와 **Signaling Theory (Spence, 1973)**를 결합하여 교육기관 이슈의 프레임 세력 역학을 분석합니다.

## 교육기관 프레임 3분류
- **지배적(dominant)**: 현재 교육기관 논의를 주도하는 프레임. 학부모·주류 언론·입시 커뮤니티가 이 관점 사용
- **도전적(challenging)**: 재학생·불만 집단·비판 세력이 확산시키는 프레임. 방치 시 지배 프레임 전복 가능
- **기관 공식(institution_official)**: 교육기관이 홍보·공식 발표를 통해 유지하려는 프레임

## Rankings Dynamics 적용 (Espeland & Sauder, 2007)
- 순위 변동이 온라인 여론 프레임 전환에 미치는 영향 분석
- "순위 상승" 신호를 각 이해관계자 집단이 어떻게 수신하고 해석하는지 측정
- 순위·지표와 실제 학생 경험 간 프레임 충돌 지점 식별

## Signaling Theory 적용 (Spence, 1973)
- 기관이 발신하는 신호(입결·취업률·연구성과)가 어떤 프레임으로 공론화되는지 분석
- 공식 신호가 신뢰를 얻는 조건 vs 역효과를 낳는 조건 분류

## sentiment-framing과의 차별화
- sentiment-framing이 "어떤 프레임이 있는가"를 식별했다면
- 이 모듈은 "프레임 간 힘의 관계"와 "기관 공식 프레임의 신뢰도"를 분석
- 기관 메시지와 학생 경험 간 세력 역학 중심
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
    const reputationIndex = priorResults['institutional-reputation-index'] as any;

    const existingFrames =
      sentimentFraming?.positiveFrames || sentimentFraming?.negativeFrames
        ? [
            ...((sentimentFraming?.positiveFrames ?? []) as { frame: string }[]).slice(0, 3),
            ...((sentimentFraming?.negativeFrames ?? []) as { frame: string }[]).slice(0, 3),
          ]
            .map((f) => `- ${f.frame}`)
            .join('\n')
        : '';

    const reputationSummary = reputationIndex?.summary
      ? `평판 지수 요약: ${reputationIndex.summary}`
      : '';
    const signalingGapCount = reputationIndex?.signalingGaps?.length ?? 0;

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 선행 분석: 프레임 목록 (sentiment-framing)
${existingFrames}

## 선행 분석: 기관 평판 지수 (institutional-reputation-index)
${reputationSummary}
${signalingGapCount > 0 ? `신호-수신 간극 ${signalingGapCount}개 식별됨` : ''}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 주요 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 150)}`)
  .join('\n')}

---
교육기관 프레임의 세력 역학을 분석하세요.
기관 공식 프레임 vs 학생 경험 프레임 간 충돌 구조와 순위 변동이 프레임에 미치는 영향을 Espeland & Sauder(2007) 이론으로 분석하세요.
프레임 전환 트리거와 기관에 유리한 커뮤니케이션 방향을 도출하세요.`;
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
  .map((c) => `- [${c.source}] ${c.content.slice(0, 150)}`)
  .join('\n')}

---
Rankings Dynamics와 Signaling Theory를 적용하여 교육기관 여론 프레임 세력 역학을 분석하세요.`;
  },
};
