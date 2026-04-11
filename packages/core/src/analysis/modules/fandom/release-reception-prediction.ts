import {
  ReleaseReceptionPredictionSchema,
  type ReleaseReceptionPredictionResult,
} from '../../schemas/release-reception-prediction.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import {
  ANALYSIS_CONSTRAINTS,
  getProbabilityAnchor,
  distillForWinSimulation,
  formatDateRange,
} from '../prompt-utils';

const config = MODULE_MODEL_MAP['release-reception-prediction'];

/**
 * ADVN-F04: 컴백/신곡 반응 예측 모듈
 * win-simulation의 팬덤 도메인 대체.
 * 현재 팬덤 열기, 경쟁 환경, 플랫폼별 기대감을 종합하여 반응을 예측한다.
 */
export const releaseReceptionPredictionModule: AnalysisModule<ReleaseReceptionPredictionResult> = {
  name: 'release-reception-prediction',
  displayName: '컴백/신곡 반응 예측',
  provider: config.provider,
  model: config.model,
  schema: ReleaseReceptionPredictionSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    return `당신은 K-POP 컴백/데뷔 반응 예측 및 시뮬레이션 전문가입니다.
선행 분석 결과를 종합하여 **컴백/신곡의 예상 반응, 성공/리스크 요인, 실행 계획**을 도출합니다.

## 예측 프레임워크

### predictedReception 판단 기준
- **explosive**: 전 플랫폼 실시간 트렌드 점유, 초동 기록 경신 가능, 국제 팬 대규모 참여
- **positive**: 팬덤 내 열기 높음, 일반 대중 호감, 안정적 차트 진입 예상
- **mixed**: 팬덤은 긍정이나 일반 대중 무관심, 또는 경쟁 그룹과 시장 경합
- **negative**: 선행 이슈/스캔들이 반응에 부정적 영향, 안티팬 공격 예상
- **controversial**: 팬덤 내 의견 분분, 음악적 변화에 대한 호불호 갈림

### 성공 요인 평가 (successFactors)
- **팬덤 열기**: 스트리밍 의지, 프리오더, 쇼케이스 반응
- **음악 품질**: 타이틀곡/수록곡 평가, 프로듀서/작곡가 참여
- **타이밍**: 경쟁 그룹 컴백 시기, 시즌 적합성, 이벤트 연계
- **프로모션**: 콘셉트, 뮤직비디오, 예능 출연, 챌린지
- **글로벌**: 해외 팬 반응, 글로벌 플랫폼 진입 가능성

### 리스크 요인 평가 (riskFactors)
- 선행 스캔들/논란의 지속 여부
- 경쟁 그룹과의 직접 대결
- 기획사 프로모션 전략의 적절성
- 팬덤 내 갈등/분열 상태

${getProbabilityAnchor(domain)}
${ANALYSIS_CONSTRAINTS}`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles
      .slice(0, 15)
      .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
      .join('\n');
    const commentsSample = data.comments
      .slice(0, 20)
      .map((c) => `- ${c.content.slice(0, 100)}`)
      .join('\n');

    return `키워드: "${data.keyword}"
${formatDateRange(data)}

## 주요 기사 (${data.articles.length}건 중 상위 15건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 20건)
${commentsSample}

## 예측 절차 (반드시 이 순서로 수행)

### Step 1: 현재 팬덤 상태 진단
- 팬덤 열기 수준, 최근 반응 추세, 주요 관심사를 파악하세요

### Step 2: 성공 요인 분석 (3~7개)
- 반응에 긍정적 영향을 미칠 요인을 도출하세요
- 각 요인의 현재 상태(strong/moderate/weak/unknown)와 중요도를 평가하세요

### Step 3: 리스크 요인 분석 (2~5개)
- 반응에 부정적 영향을 미칠 요인을 도출하세요
- 각 리스크의 수준과 완화 방안을 기술하세요

### Step 4: 플랫폼별 전망
- 주요 플랫폼(음원사이트, 유튜브, SNS, 커뮤니티)별 예상 반응을 분석하세요
- 각 플랫폼의 핵심 지표를 제시하세요

### Step 5: 실행 계획 + 종합 요약
- 반응을 극대화하기 위한 실행 항목을 우선순위 순으로 제시하세요
- simulationSummary에 전체 예측 결과를 3~5줄로 요약하세요`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const basePrompt = this.buildPrompt(data);
    const distilledContext = distillForWinSimulation(priorResults);

    return `${basePrompt}

## 전체 선행 분석 핵심 요약
${distilledContext}

위 분석 결과를 종합하여 반응 예측을 수행하세요.
선행 전략(strategy)을 그대로 반복하지 말고, 예측 관점에서 재구성하세요.`;
  },
};
