/**
 * LLM 비용 예측 + 자동 모델 다운그레이드
 *
 * 파이프라인 시작 전 예상 토큰 비용을 계산하고, 예산 초과가 예상되면
 * 더 저렴한 모델로 자동 다운그레이드 제안을 생성한다.
 *
 * 비용 예측:
 *   입력 토큰 ≈ (articles × avg_article_tokens + comments × avg_comment_tokens + system_prompt)
 *   출력 토큰은 schema 복잡도 기반 고정값 추정
 *
 * 다운그레이드 후보:
 *   claude-sonnet-4-6   → claude-haiku-4-5 (약 75% 저렴)
 *   claude-opus-4-7     → claude-sonnet-4-6 (약 80% 저렴)
 *   gpt-4.1             → gpt-4.1-mini (약 80% 저렴)
 *   gemini-2.5-pro      → gemini-2.5-flash (약 88% 저렴)
 */
import type { AnalysisInput } from './types';
import { calculateCost } from './cost-calculator';

/** 한국어 텍스트 기준 대략적인 토큰 수 (1 토큰 ≈ 1.5 chars) */
function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 1.5);
}

/** AnalysisInput의 총 입력 토큰 추정 */
export function estimateInputTokens(input: AnalysisInput): number {
  let total = 0;
  for (const a of input.articles) {
    total += estimateTokens(a.title) + estimateTokens(a.content);
  }
  for (const c of input.comments) {
    total += estimateTokens(c.content);
  }
  for (const v of input.videos) {
    total += estimateTokens(v.title) + estimateTokens(v.description);
  }
  // 시스템 프롬프트 + 도메인 컨텍스트 + 지시문 오버헤드
  total += 3000;
  return total;
}

/** 모듈별 예상 출력 토큰 (schema 복잡도 기반 경험값) */
const OUTPUT_TOKEN_ESTIMATES: Record<string, number> = {
  'macro-view': 2000,
  segmentation: 1500,
  'sentiment-framing': 2000,
  'message-impact': 1500,
  'risk-map': 3000,
  opportunity: 2500,
  strategy: 3500,
  'final-summary': 4000,
  'approval-rating': 2000,
  'frame-war': 3000,
  'crisis-scenario': 4000,
  'win-simulation': 3500,
};

export interface ModulePrediction {
  moduleName: string;
  provider: string;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
}

export interface PipelinePrediction {
  totalCostUsd: number;
  modules: ModulePrediction[];
}

/**
 * 전체 파이프라인 예상 비용 계산
 */
export function predictPipelineCost(
  input: AnalysisInput,
  modules: Array<{
    name: string;
    provider: string;
    model: string;
  }>,
): PipelinePrediction {
  const inputTokens = estimateInputTokens(input);

  const predictions: ModulePrediction[] = modules.map((m) => {
    const outputTokens = OUTPUT_TOKEN_ESTIMATES[m.name] ?? 2000;
    const cost = calculateCost(inputTokens, outputTokens, m.model);
    return {
      moduleName: m.name,
      provider: m.provider,
      model: m.model,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostUsd: cost,
    };
  });

  return {
    totalCostUsd: predictions.reduce((sum, p) => sum + p.estimatedCostUsd, 0),
    modules: predictions,
  };
}

/** 모델 다운그레이드 규칙 */
const DOWNGRADE_MAP: Record<string, { model: string; savingPercent: number }> = {
  'claude-opus-4-7': { model: 'claude-sonnet-4-6', savingPercent: 80 },
  'claude-sonnet-4-6': { model: 'claude-haiku-4-5-20251001', savingPercent: 75 },
  'claude-sonnet-4-20250514': { model: 'claude-haiku-4-20250414', savingPercent: 73 },
  'gpt-4.1': { model: 'gpt-4.1-mini', savingPercent: 80 },
  'gpt-4.1-mini': { model: 'gpt-4.1-nano', savingPercent: 75 },
  'gpt-4o': { model: 'gpt-4o-mini', savingPercent: 94 },
  'gemini-2.5-pro': { model: 'gemini-2.5-flash', savingPercent: 88 },
  'gemini-2.5-flash': { model: 'gemini-2.0-flash', savingPercent: 33 },
  'deepseek-reasoner': { model: 'deepseek-chat', savingPercent: 50 },
};

export interface DowngradeDecision {
  moduleName: string;
  originalModel: string;
  suggestedModel: string;
  originalCost: number;
  suggestedCost: number;
  savingUsd: number;
}

/**
 * 예산 초과 시 다운그레이드 제안 생성
 * 비용 영향이 큰 모듈부터 우선 다운그레이드 (greedy)
 */
export function suggestDowngrades(
  prediction: PipelinePrediction,
  budgetUsd: number,
): {
  decisions: DowngradeDecision[];
  originalTotal: number;
  adjustedTotal: number;
  withinBudget: boolean;
} {
  const decisions: DowngradeDecision[] = [];
  let currentTotal = prediction.totalCostUsd;

  // 비용 내림차순 정렬 — 비싼 모듈부터 다운그레이드
  const sortedModules = [...prediction.modules].sort(
    (a, b) => b.estimatedCostUsd - a.estimatedCostUsd,
  );

  for (const m of sortedModules) {
    if (currentTotal <= budgetUsd) break;
    const rule = DOWNGRADE_MAP[m.model];
    if (!rule) continue;

    const newCost = calculateCost(m.estimatedInputTokens, m.estimatedOutputTokens, rule.model);
    const saving = m.estimatedCostUsd - newCost;
    decisions.push({
      moduleName: m.moduleName,
      originalModel: m.model,
      suggestedModel: rule.model,
      originalCost: m.estimatedCostUsd,
      suggestedCost: newCost,
      savingUsd: saving,
    });
    currentTotal -= saving;
  }

  return {
    decisions,
    originalTotal: prediction.totalCostUsd,
    adjustedTotal: currentTotal,
    withinBudget: currentTotal <= budgetUsd,
  };
}
