// apps/web/src/components/llm-insights/llm-recommendation-data.ts

export type KoreanLevel = '상' | '중' | '하';
export type Tier = 'best' | 'standard' | 'minimal';

export interface ModelRecommendation {
  provider: string;
  model: string;
  reason: string;
}

export interface ModuleRecommendation {
  best: ModelRecommendation;
  standard: ModelRecommendation;
  minimal: ModelRecommendation;
}

// 모듈별 추천 매트릭스 (llm-model-recommendations.md Part 2.3 기반)
export const MODULE_RECOMMENDATIONS: Record<string, ModuleRecommendation> = {
  'macro-view': {
    best: {
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      reason: '1M 컨텍스트, 할루시네이션 0.7%, 한국어 상급',
    },
    standard: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '속도·비용 균형, 1M 컨텍스트',
    },
    minimal: { provider: 'gemini', model: 'gemini-2.5-flash-lite', reason: '초저가 $0.10/MTok' },
  },
  segmentation: {
    best: {
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      reason: '1M 컨텍스트, 패턴 분류 최고 정확도',
    },
    standard: { provider: 'gemini', model: 'gemini-2.5-flash', reason: '패턴 분류에 비용 효율적' },
    minimal: { provider: 'openai', model: 'gpt-4.1-nano', reason: '단순 분류용 최저가' },
  },
  'sentiment-framing': {
    best: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '한국어 최고 수준, JSON 신뢰성 최상',
    },
    standard: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '감정 분류에 비용 대비 성능 우수',
    },
    minimal: {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      reason: '초저가, 배치 모드 가능',
    },
  },
  'message-impact': {
    best: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '메시지 영향 분석 최고 성능',
    },
    standard: { provider: 'openai', model: 'gpt-4.1-mini', reason: '정량적 분석에 적합' },
    minimal: { provider: 'gemini', model: 'gemini-2.5-flash-lite', reason: '초저가' },
  },
  'risk-map': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '최고 지능, 복잡한 추론' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '품질·비용 균형 최적' },
    minimal: { provider: 'deepseek', model: 'deepseek-reasoner', reason: '추론 특화 초저가' },
  },
  opportunity: {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '창의적 인사이트 도출 최고' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '창의적 인사이트 강점' },
    minimal: { provider: 'deepseek', model: 'deepseek-reasoner', reason: '추론 특화 초저가' },
  },
  strategy: {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '전략 수립 최고 추론' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '전략 수립 깊은 추론' },
    minimal: { provider: 'deepseek', model: 'deepseek-reasoner', reason: '추론 특화' },
  },
  'final-summary': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '다중 결과 종합 최고 성능' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '정리 능력 뛰어남' },
    minimal: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      reason: '한국어 상급, 고속',
    },
  },
  'approval-rating': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '복잡한 시나리오 최적' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '수치 추정 정밀 추론' },
    minimal: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      reason: '한국어 상급 유지',
    },
  },
  'frame-war': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '미묘한 언어 전략 분석' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '담론 분석 고급 모델' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'crisis-scenario': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '복합 시나리오 최적' },
    standard: { provider: 'openai', model: 'o4-mini', reason: '추론 특화, o3 대비 절반 가격' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'win-simulation': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '전체 결과 종합 시뮬레이션' },
    standard: { provider: 'openai', model: 'o4-mini', reason: '추론 특화' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'fan-loyalty-index': {
    best: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '팬덤 심리 고이해력' },
    standard: { provider: 'gemini', model: 'gemini-2.5-flash', reason: '비용 효율적' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'fandom-narrative-war': {
    best: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '복합 내러티브 고급 추론' },
    standard: { provider: 'gemini', model: 'gemini-2.5-flash', reason: '비용 효율' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'fandom-crisis-scenario': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '팬덤 위기 전문 분석' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '시뮬레이션 품질' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'release-reception-prediction': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '예측 정확도 최고' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '예측 성능 충분' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
};

// 모델의 한국어 성능 등급 (llm-model-recommendations.md Part 1.1/1.2 기반)
export const MODEL_KOREAN_LEVEL: Record<string, KoreanLevel> = {
  'claude-opus-4-6': '상',
  'claude-sonnet-4-6': '상',
  'claude-haiku-4-5-20251001': '상',
  'claude-sonnet-4-20250514': '상',
  'claude-haiku-4-20250414': '상',
  'gemini-2.5-pro': '상',
  'gemini-2.5-flash': '상',
  'gemini-2.5-flash-lite': '중',
  'gemini-2.0-flash': '상',
  'gpt-4.1': '상',
  'gpt-4.1-mini': '상',
  'gpt-4.1-nano': '중',
  'gpt-4o': '상',
  'gpt-4o-mini': '상',
  o3: '상',
  'o4-mini': '상',
  'deepseek-chat': '중',
  'deepseek-v4': '중',
  'deepseek-reasoner': '중',
};

// Stage 매핑 (모듈명 → Stage)
export const MODULE_STAGE: Record<string, 1 | 2 | 3 | 4> = {
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
  'fan-loyalty-index': 4,
  'fandom-narrative-war': 4,
  'fandom-crisis-scenario': 4,
  'release-reception-prediction': 4,
  'stakeholder-map': 4,
  'esg-sentiment': 4,
  'reputation-index': 4,
  'crisis-type-classifier': 4,
  'media-framing-dominance': 4,
  'csr-communication-gap': 4,
  'reputation-recovery-simulation': 4,
  'health-risk-perception': 4,
  'compliance-predictor': 4,
  'market-sentiment-index': 4,
  'information-asymmetry': 4,
  'catalyst-scenario': 4,
  'investment-signal': 4,
  'performance-narrative': 4,
  'season-outlook-prediction': 4,
  'institutional-reputation-index': 4,
  'education-opinion-frame': 4,
  'education-crisis-scenario': 4,
  'education-outcome-simulation': 4,
};

// 문제점 진단: 현재 모델에서 경고를 생성
export interface ModelWarning {
  type: 'korean-limited' | 'underspec' | 'context-limit';
  label: string;
}

export function getModelWarnings(moduleName: string, model: string): ModelWarning[] {
  const warnings: ModelWarning[] = [];
  const koreanLevel = MODEL_KOREAN_LEVEL[model];

  if (koreanLevel === '중' || koreanLevel === '하') {
    warnings.push({ type: 'korean-limited', label: '한국어 뉘앙스 제한' });
  }

  const rec = MODULE_RECOMMENDATIONS[moduleName];
  if (rec) {
    const isMinimalMatch =
      model === rec.minimal.model || model === rec.standard.model || model === rec.best.model;
    if (!isMinimalMatch) {
      warnings.push({ type: 'underspec', label: '추천 미달' });
    }
  }

  return warnings;
}
