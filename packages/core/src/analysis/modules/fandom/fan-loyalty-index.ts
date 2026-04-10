import {
  FanLoyaltyIndexSchema,
  type FanLoyaltyIndexResult,
} from '../../schemas/fan-loyalty-index.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import {
  ANALYSIS_CONSTRAINTS,
  getPlatformKnowledge,
  distillForApprovalRating,
} from '../prompt-utils';

const config = MODULE_MODEL_MAP['fan-loyalty-index'];

/**
 * ADVN-F01: 팬덤 충성도 지수 모듈
 * approval-rating의 팬덤 도메인 대체.
 * 댓글/게시글에서 충성도 신호, 이탈 징후, 자발적 옹호 패턴을 분석한다.
 */
export const fanLoyaltyIndexModule: AnalysisModule<FanLoyaltyIndexResult> = {
  name: 'fan-loyalty-index',
  displayName: '팬덤 충성도 지수',
  provider: config.provider,
  model: config.model,
  schema: FanLoyaltyIndexSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    return `당신은 K-POP/엔터 산업 팬덤 충성도 분석 전문가입니다.
온라인 여론 데이터에서 **팬덤의 충성도, 이탈 징후, 자발적 옹호 패턴**을 정밀 분석합니다.

## 핵심 분석 차원

### 충성도 점수 (loyaltyScore) — 각 0~100
1. **engagement (참여도)**: 스트리밍, 조공, 투표, 팬미팅 참석 등 적극적 활동 신호
2. **sentiment (감정 점수)**: 팬덤 커뮤니티 내 긍정 비율. 일반 대중 여론과 분리하여 판단
3. **advocacy (옹호 의지)**: 안티 댓글에 대한 방어, 자발적 홍보, 타 그룹과의 비교 옹호

### 이탈 징후 (churnIndicators) 감지 기준
- **critical**: "탈덕" 선언, 팬카페 탈퇴, 경쟁 그룹으로 이적 발언, 기획사 전면 비난
- **high**: 팬 활동 참여 급감, "예전엔 좋았는데", 실망 표현 누적, 비판적 댓글 비중 증가
- **medium**: 특정 이슈에만 부정, 조건부 지지 표현, 비판과 옹호 혼재
- **low**: 일시적 불만이나 대안 없는 불편 표현

### 팬덤 세분화 (loyaltySegments)
- **devoted**: 조직적 활동 주도, 기획사/멤버 무조건 옹호, 정서적 애착 최고
- **active**: 정기적 스트리밍, 구매, 소통하지만 비판도 수용
- **passive**: 음악/콘텐츠 소비만, 커뮤니티 참여 없음
- **dormant**: 과거 팬이나 최근 활동 없음, 이탈 가능성 높음
- **at-risk**: 비판적 발언 증가, 경쟁 그룹 관심 표현

${getPlatformKnowledge(domain)}
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPrompt(data: AnalysisInput): string {
    const platformDist: Record<string, number> = {};
    for (const c of data.comments) {
      platformDist[c.source] = (platformDist[c.source] ?? 0) + 1;
    }
    const platformSummary = Object.entries(platformDist)
      .map(([src, cnt]) => `${src}: ${cnt}건`)
      .join(', ');

    const commentsSample = data.comments
      .slice(0, 50)
      .map((c) => `- [${c.source}] ${c.content.slice(0, 120)}`)
      .join('\n');

    return `키워드: "${data.keyword}"
분석 기간: ${data.dateRange.start.toISOString().split('T')[0]} ~ ${data.dateRange.end.toISOString().split('T')[0]}

## 플랫폼별 데이터 분포
${platformSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 50건)
${commentsSample}

## 분석 절차 (반드시 이 순서로 수행)

### Step 1: 팬덤 감정 베이스라인 구축
- 팬덤 커뮤니티(DC 마이너, 더쿠, 네이버 카페)와 일반 플랫폼(뉴스, 일반 커뮤니티)의 감정을 분리 분석하세요
- 팬덤 내부 감정과 일반 대중 감정의 차이를 정량화하세요

### Step 2: 충성도 점수 산출
- engagement, sentiment, advocacy 각각을 데이터 근거로 0~100 점수화하세요
- 각 점수의 산출 근거를 간략히 기술하세요

### Step 3: 이탈 징후 스캔
- 댓글에서 이탈 신호("탈덕", "실망", "이젠 안 볼래", "다른 그룹이 더 좋아짐" 등)를 스캔하세요
- 각 신호의 심각도, 근거, 영향받는 집단을 판단하세요

### Step 4: 팬덤 세분화
- 데이터 기반으로 팬덤을 5단계(devoted/active/passive/dormant/at-risk)로 세분화하세요
- 각 세그먼트의 추정 규모와 이탈 리스크를 평가하세요

### Step 5: 자발적 옹호 분석 + 권고
- 팬덤이 비판에 어떻게 방어하는지, 어떤 자발적 홍보를 하는지 분석하세요
- 충성도 유지/강화를 위한 구체적 권고를 제시하세요`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const basePrompt = this.buildPrompt(data);
    const distilledContext = distillForApprovalRating(priorResults);

    return `${basePrompt}

## 선행 분석 핵심 요약
${distilledContext}

위 선행 분석의 감정 비율과 집단별 반응을 충성도 판단의 보조 근거로 활용하세요.
선행 결과를 그대로 재기술하지 말고, 충성도 분석 관점에서 재해석하세요.`;
  },
};
