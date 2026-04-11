import {
  FandomNarrativeWarSchema,
  type FandomNarrativeWarResult,
} from '../../schemas/fandom-narrative-war.schema';
import type { AnalysisModule, AnalysisInput } from '../../types';
import type { AnalysisDomain } from '../../domain';
import { MODULE_MODEL_MAP } from '../../types';
import {
  ANALYSIS_CONSTRAINTS,
  getFrameStrengthAnchor,
  distillForFrameWar,
  formatDateRange,
} from '../prompt-utils';

const config = MODULE_MODEL_MAP['fandom-narrative-war'];

/**
 * ADVN-F02: 팬덤 내러티브 경쟁 분석 모듈
 * frame-war의 팬덤 도메인 대체.
 * 팬덤 vs 안티, 소속사 vs 팬덤, 경쟁 팬덤 간 내러티브 경쟁 구조를 분석한다.
 */
export const fandomNarrativeWarModule: AnalysisModule<FandomNarrativeWarResult> = {
  name: 'fandom-narrative-war',
  displayName: '팬덤 내러티브 경쟁 분석',
  provider: config.provider,
  model: config.model,
  schema: FandomNarrativeWarSchema,

  buildSystemPrompt(domain?: AnalysisDomain): string {
    return `당신은 엔터 산업 내러티브 분석 및 팬덤 담론 역학 전문가입니다.
선행 분석(sentiment-framing)에서 식별된 프레임을 출발점으로, **팬덤 생태계 내 내러티브 경쟁과 전선 구도**를 심층 분석합니다.

## 핵심 분석 축

### 1. 내러티브 출처별 역학
- **fans (팬)**: "실력 인정 서사", "성장 서사", "억울한 피해자론"
- **anti-fans (안티팬)**: "과대평가론", "표절 의혹론", "팬덤 민폐론"
- **media (언론)**: "이슈메이커 프레임", "스캔들 중심 보도"
- **general-public (일반 대중)**: "비주얼/트렌드 중심", "무관심→관심 전환"
- **company (기획사)**: "전략적 마케팅 서사", "공식 입장 프레임"

### 2. 팬덤 간 경쟁 (fanbaseRivalry)
- 타 팬덤과의 갈등 전선: 음원 성적, 조회수, 예능 출연, 수상
- DC 마이너 갤러리, 트위터 등에서의 팬덤 전쟁 패턴
- 갈등이 양측 이미지에 미치는 영향

### 3. 내러티브 강도 평가 기준
${getFrameStrengthAnchor(domain)}

## 핵심 원칙 — sentiment-framing과의 차별화
- sentiment-framing이 "어떤 감정/프레임이 있는가"를 식별했다면, 이 모듈은 "누가 어떤 내러티브를 밀고, 그 힘 관계가 어떤가"를 분석합니다
- sentiment-framing의 결과를 반복하지 말고, 내러티브 간 **세력 역학**에 집중하세요

${ANALYSIS_CONSTRAINTS}`;
  },

  buildPrompt(data: AnalysisInput): string {
    const articlesSummary = data.articles
      .slice(0, 20)
      .map((a) => `- [${a.publisher ?? '알 수 없음'}] ${a.title}`)
      .join('\n');
    const commentsSample = data.comments
      .slice(0, 30)
      .map((c) => `- [${c.source}] ${c.content.slice(0, 100)}`)
      .join('\n');

    return `키워드: "${data.keyword}"
${formatDateRange(data)}

## 주요 기사 (${data.articles.length}건 중 상위 20건)
${articlesSummary}

## 대표 댓글 (${data.comments.length}건 중 상위 30건)
${commentsSample}

## 분석 절차 (반드시 이 순서로 수행)

### Step 1: 지배적 내러티브 식별
- 데이터에서 작동 중인 주요 내러티브를 식별하고 출처(fans/anti-fans/media/general-public/company)를 분류하세요
- 각 내러티브의 강도(0~100)를 평가하고 확산 패턴을 기술하세요

### Step 2: 대응 내러티브 분석
- 지배적 내러티브에 도전하는 반박 내러티브를 식별하세요
- 각 대응 내러티브의 위협 수준과 발원 플랫폼을 파악하세요

### Step 3: 팬덤 간 경쟁 구도
- 다른 팬덤/그룹과의 경쟁 갈등이 있는지 파악하세요
- 경쟁이 일어나는 플랫폼, 이슈, 현재 우위를 분석하세요

### Step 4: 전장 종합
- battlefieldSummary에 내러티브 전장의 전체 구도를 3~5줄로 요약하세요`;
  },

  buildPromptWithContext(
    data: AnalysisInput,
    priorResults: Record<string, unknown>,
    _domain?: AnalysisDomain,
  ): string {
    const basePrompt = this.buildPrompt(data);
    const distilledContext = distillForFrameWar(priorResults);

    return `${basePrompt}

## 선행 분석 핵심 요약
${distilledContext}

위 선행 분석을 기반으로 내러티브 경쟁 구조를 심층 분석하세요.
sentiment-framing의 프레임 목록을 반복하지 말고, 내러티브 간 **힘의 관계**에 집중하세요.`;
  },
};
