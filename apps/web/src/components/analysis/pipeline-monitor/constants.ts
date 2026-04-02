// 파이프라인 모니터 상수 — 도움말 텍스트, Stage 매핑, 비용 상수

// --- 파이프라인 단계 도움말 ---

export const STAGE_HELP: Record<string, { title: string; description: string; details: string[] }> =
  {
    collection: {
      title: '데이터 수집',
      description: '선택된 플랫폼에서 키워드 관련 기사, 영상, 게시글, 댓글을 자동으로 수집합니다.',
      details: [
        '네이버 뉴스: Playwright로 기사 본문과 댓글 스크래핑',
        '유튜브: YouTube Data API v3로 영상 메타데이터 + 댓글 수집',
        '커뮤니티(DC갤러리, 에펨코리아, 클리앙): 게시글 + 댓글 스크래핑',
        '각 소스는 독립적으로 실행되며, 일부 실패 시에도 나머지는 계속 진행',
        '기본 수집 한도: 뉴스 100건, 유튜브 50건, 커뮤니티 50건, 댓글 500건/항목',
      ],
    },
    normalization: {
      title: '데이터 정규화',
      description: '수집된 원본 데이터를 통일된 형식으로 변환하고 DB에 저장합니다.',
      details: [
        '각 플랫폼별 다른 데이터 구조를 공통 스키마로 변환',
        'sourceId 기반 중복 제거 (같은 기사/댓글 재수집 방지)',
        '기사→댓글, 영상→댓글 간 FK(외래키) 관계 매핑',
      ],
    },
    'item-analysis': {
      title: '개별 감정 분석',
      description: '각 기사/댓글의 감정(긍정/부정/중립)을 개별적으로 판별합니다.',
      details: [
        '1차: 경량 AI 모델로 전체 항목을 빠르게 분류 (1~2초)',
        '2차: 판별이 애매한 항목만 LLM으로 정밀 재분석',
        '결과는 기사/댓글 개별 레코드에 sentiment, sentimentScore로 저장',
        '이 단계는 옵션이며, 비활성화 시 건너뜁니다',
      ],
    },
    analysis: {
      title: 'AI 분석',
      description: '수집된 데이터를 12개 분석 모듈이 AI(GPT/Claude)로 심층 분석합니다.',
      details: [
        'Stage 1 (병렬): 감정 프레이밍, 거시 분석, 세그멘테이션, 메시지 임팩트',
        'Stage 2 (순차): 리스크 맵, 기회 발굴, 전략 제안 — Stage 1 결과 참조',
        'Stage 3: 종합 요약 — 전체 결과 통합',
        'Stage 4 (고급): 지지율 분석, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션',
        '각 모듈은 Zod 스키마로 구조화된 JSON 결과를 생성',
      ],
    },
    report: {
      title: '리포트 생성',
      description: '모든 분석 결과를 종합하여 마크다운 형식의 전략 리포트를 생성합니다.',
      details: [
        'Stage 1~3 완료 후 1차 리포트 생성',
        'Stage 4 고급 분석 완료 시 리포트 재생성 (고급 분석 포함)',
        '부분 실패 시에도 가용한 결과로 리포트 작성',
      ],
    },
  };

// --- 분석 모듈 도움말 ---

export const MODULE_HELP: Record<
  string,
  { description: string; provider: string; model: string; stage: number; stageLabel: string }
> = {
  'sentiment-framing': {
    description:
      '기사/댓글의 감정 톤(긍정/부정/중립)과 프레이밍 방식을 분석합니다. 미디어가 특정 인물을 어떤 프레임으로 보도하는지 파악합니다.',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    stage: 1,
    stageLabel: 'Stage 1 (병렬)',
  },
  'macro-view': {
    description:
      '여론의 전체적 흐름과 거시적 트렌드를 분석합니다. 시간에 따른 여론 변화, 주요 이슈의 등장과 소멸 패턴을 파악합니다.',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    stage: 1,
    stageLabel: 'Stage 1 (병렬)',
  },
  segmentation: {
    description:
      '여론 참여자를 그룹별로 분류합니다. 지지층, 반대층, 부동층 등의 세그먼트별 특성과 크기를 식별합니다.',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    stage: 1,
    stageLabel: 'Stage 1 (병렬)',
  },
  'message-impact': {
    description:
      '특정 발언이나 이벤트가 여론에 미친 영향력을 측정합니다. 바이럴 효과, 감정 전환점, 핵심 키워드를 추출합니다.',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    stage: 1,
    stageLabel: 'Stage 1 (병렬)',
  },
  'risk-map': {
    description:
      '잠재적 리스크 요인을 식별하고 영향도/발생 확률로 매핑합니다. Stage 1 결과를 기반으로 위협 요소를 종합 분석합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 2,
    stageLabel: 'Stage 2 (순차)',
  },
  opportunity: {
    description:
      '여론 흐름에서 활용 가능한 기회를 발굴합니다. 긍정 여론 강화 포인트, 설득 가능 세그먼트, 전략적 타이밍을 제안합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 2,
    stageLabel: 'Stage 2 (순차)',
  },
  strategy: {
    description:
      '분석 결과를 종합하여 구체적인 대응 전략을 제안합니다. 메시지 방향, 매체 전략, 위기 대응 시나리오를 포함합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 2,
    stageLabel: 'Stage 2 (순차)',
  },
  'final-summary': {
    description:
      'Stage 1~2의 모든 분석 결과를 하나의 종합 요약으로 통합합니다. 핵심 발견, 주요 지표, 즉시 행동 사항을 정리합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 3,
    stageLabel: 'Stage 3 (종합)',
  },
  'approval-rating': {
    description:
      '수집 데이터를 기반으로 지지율 추이를 추정합니다. 긍정/부정 비율 변화, 핵심 이슈별 지지율 영향을 분석합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 4,
    stageLabel: 'Stage 4 (고급)',
  },
  'frame-war': {
    description:
      '서로 다른 진영이 사용하는 프레이밍 전략을 비교 분석합니다. 프레임 충돌 지점, 지배적 프레임, 반격 프레임을 식별합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 4,
    stageLabel: 'Stage 4 (고급)',
  },
  'crisis-scenario': {
    description:
      '리스크 분석과 지지율 데이터를 결합하여 위기 시나리오를 시뮬레이션합니다. 최악/최선/가능성 높은 시나리오별 대응책을 제시합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 4,
    stageLabel: 'Stage 4 (고급)',
  },
  'win-simulation': {
    description:
      '모든 분석 데이터를 종합하여 승리(목표 달성) 전략을 시뮬레이션합니다. 최적 경로, 핵심 변수, 실행 타임라인을 도출합니다.',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-20250514',
    stage: 4,
    stageLabel: 'Stage 4 (고급)',
  },
};

// --- 모듈 → Stage 매핑 ---

export const MODULE_STAGE_MAP: Record<string, number> = {
  'macro-view': 1,
  segmentation: 1,
  'sentiment-framing': 1,
  'message-impact': 1,
  'risk-map': 2,
  opportunity: 2,
  strategy: 2,
  'final-summary': 3,
  'approval-rating': 4,
  'frame-war': 4,
  'crisis-scenario': 4,
  'win-simulation': 4,
};

export const STAGE_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'Stage 1 — 기초 분석', description: '독립적으로 병렬 실행되는 4개 기초 모듈' },
  2: { label: 'Stage 2 — 심층 분석', description: 'Stage 1 결과를 참조하여 순차 실행' },
  3: { label: 'Stage 3 — 종합 요약', description: '모든 선행 결과를 통합하여 요약 생성' },
  4: { label: 'Stage 4 — 고급 분석', description: '전략적 시뮬레이션 및 예측 분석' },
};

// --- 모듈 한글 라벨 ---

export const MODULE_LABELS: Record<string, string> = {
  'sentiment-framing': '감정 프레이밍 (Sentiment Framing)',
  'macro-view': '거시 분석 (Macro View)',
  segmentation: '세그멘테이션 (Segmentation)',
  'message-impact': '메시지 임팩트 (Message Impact)',
  'risk-map': '리스크 맵 (Risk Map)',
  opportunity: '기회 발굴 (Opportunity)',
  strategy: '전략 제안 (Strategy)',
  'final-summary': '종합 요약 (Final Summary)',
  'approval-rating': '지지율 분석 (Approval Rating)',
  'frame-war': '프레임 전쟁 (Frame War)',
  'crisis-scenario': '위기 시나리오 (Crisis Scenario)',
  'win-simulation': '승리 시뮬레이션 (Win Simulation)',
};

// --- 소스 도움말 ---

export const SOURCE_HELP: Record<string, { label: string; description: string; method: string }> = {
  'naver-news': {
    label: '네이버 뉴스',
    description: '네이버 뉴스 기사 본문과 댓글을 수집합니다.',
    method: 'Playwright 브라우저 자동화',
  },
  naver: {
    label: '네이버 뉴스',
    description: '네이버 뉴스 기사 본문과 댓글을 수집합니다.',
    method: 'Playwright 브라우저 자동화',
  },
  'youtube-videos': {
    label: '유튜브',
    description: '유튜브 영상 메타데이터(조회수, 좋아요 등)와 댓글을 수집합니다.',
    method: 'YouTube Data API v3',
  },
  youtube: {
    label: '유튜브',
    description: '유튜브 영상 메타데이터와 댓글을 수집합니다.',
    method: 'YouTube Data API v3',
  },
  'youtube-comments': {
    label: '유튜브 댓글',
    description: '유튜브 영상의 댓글과 답글을 수집합니다.',
    method: 'YouTube Data API v3',
  },
  dcinside: {
    label: 'DC갤러리',
    description: 'DC인사이드 갤러리 게시글과 댓글을 수집합니다.',
    method: 'Playwright 브라우저 자동화',
  },
  fmkorea: {
    label: '에펨코리아',
    description: '에펨코리아 게시글과 댓글을 수집합니다.',
    method: 'Playwright 브라우저 자동화',
  },
  clien: {
    label: '클리앙',
    description: '클리앙 게시글과 댓글을 수집합니다.',
    method: 'Playwright 브라우저 자동화',
  },
};

// --- AI 토큰 비용 상수 (USD per 1K tokens) ---

export const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  // Gemini 2.5 Flash Lite (<=128K context)
  'gemini-2.5-flash-lite': { input: 0.000075, output: 0.0003 },
  // Gemini 2.5 Flash
  'gemini-2.5-flash': { input: 0.00015, output: 0.0006 },
  // Gemini 2.0 Flash (레거시)
  'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
};

/** 토큰 사용량으로 추정 비용(USD) 계산 */
export function estimateCostUsd(inputTokens: number, outputTokens: number, model: string): number {
  const cost = TOKEN_COST_PER_1K[model];
  if (!cost) return 0;
  return (inputTokens / 1000) * cost.input + (outputTokens / 1000) * cost.output;
}

// --- 파이프라인 스텝 정의 ---

export const PIPELINE_STEPS = [
  { key: 'collection', label: '수집' },
  { key: 'normalization', label: '정규화' },
  { key: 'token-optimization', label: '토큰 최적화' },
  { key: 'item-analysis', label: '개별 감정' },
  { key: 'analysis', label: 'AI 분석' },
  { key: 'report', label: '리포트' },
] as const;
