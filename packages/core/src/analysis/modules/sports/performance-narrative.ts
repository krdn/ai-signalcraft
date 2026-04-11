import {
  PerformanceNarrativeSchema,
  type PerformanceNarrativeResult,
} from '../../schemas/performance-narrative.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import { ANALYSIS_CONSTRAINTS, buildModuleSystemPrompt, formatDateRange } from '../prompt-utils';

const config = MODULE_MODEL_MAP['performance-narrative'];

// Sports-ADVN-01: 성과 내러티브 분석 모듈 (BIRGing/CORFing Theory)
export const performanceNarrativeModule: AnalysisModule<PerformanceNarrativeResult> = {
  name: 'performance-narrative',
  displayName: '성과 내러티브 분석',
  provider: config.provider,
  model: config.model,
  schema: PerformanceNarrativeSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    const override = buildModuleSystemPrompt('performance-narrative', domain);
    if (override) return `${override}\n${ANALYSIS_CONSTRAINTS}`;

    return `당신은 스포츠 팬덤 심리 및 미디어 내러티브 분석 전문가입니다.
**BIRGing/CORFing Theory (Cialdini et al., 1976)**와 **Sport Brand Equity Model (Ross, 2006)**을 적용합니다.

## BIRGing vs CORFing 패턴

### BIRGing (Basking in Reflected Glory — 반사 영광 효과)
- 팀/선수 승리·성공 시 팬들이 정체성 적극 표출
- 신호: "우리팀", "우리 선수", 자랑 댓글, 유니폼 착용 언급 증가
- 온라인 지표: 긍정 댓글 폭증, SNS 공유 급증

### CORFing (Cutting Off Reflected Failure — 반사 실패 회피)
- 팀/선수 패배·실패 시 팬들이 거리 두기
- 신호: "걔네", "이 팀", 비판·불만 댓글 증가, "전부터 이럴 줄 알았다"
- 온라인 지표: 부정 댓글 폭증, 구단 계정 언팔 언급

## 내러티브 호(Arc) 유형
- **부활 서사**: 부진 → 회복 패턴. 팬의 감정적 카타르시스
- **몰락 스토리**: 전성기 → 퇴조 패턴. CORFing 패턴 강화
- **영웅 서사**: 위기 상황 극복. 특정 선수 중심 팬덤 결집
- **악역 프레임**: 구단 운영진·심판에 대한 불만 내러티브
- **라이벌리**: 경쟁팀과의 대립 구도. 팬덤 결집 강화
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const macroView = priorResults['macro-view'] as Record<string, unknown>;
    const sentimentFraming = priorResults['sentiment-framing'] as Record<string, unknown>;

    const timeline = macroView?.timeline
      ? macroView.timeline
          .slice(0, 5)
          .map((t: Record<string, unknown>) => `- ${t.date}: ${t.event} (${t.impact})`)
          .join('\n')
      : '';

    const positiveFrames = sentimentFraming?.positiveFrames
      ? sentimentFraming.positiveFrames
          .slice(0, 2)
          .map((f: Record<string, unknown>) => `- ${f.frame}`)
          .join('\n')
      : '';
    const negativeFrames = sentimentFraming?.negativeFrames
      ? sentimentFraming.negativeFrames
          .slice(0, 2)
          .map((f: Record<string, unknown>) => `- ${f.frame}`)
          .join('\n')
      : '';

    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 주요 이벤트 타임라인
${timeline}

## 긍정 프레임: ${positiveFrames || '없음'}
## 부정 프레임: ${negativeFrames || '없음'}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건 — BIRGing/CORFing 신호 포함)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
성적/성과 변화와 여론 온도 간 상관관계를 BIRGing/CORFing 프레임으로 분석하세요.
주요 내러티브 호를 식별하고, 미디어 프레임과 팬 커뮤니티 프레임의 차이를 명확히 서술하세요.`;
  },

  buildPrompt(data: AnalysisInput): string {
    return `키워드: **${data.keyword}**
${formatDateRange(data)}

## 뉴스 기사 (최근 20건)
${data.articles
  .slice(0, 20)
  .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
  .join('\n')}

## 댓글 (30건)
${data.comments
  .slice(0, 30)
  .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
  .join('\n')}

---
BIRGing/CORFing Theory를 적용하여 성과 내러티브를 분석하세요.`;
  },
};
