import { describe, it, expect } from 'vitest';
import { estimateInputTokens, predictPipelineCost, suggestDowngrades } from '../cost-predictor';
import type { AnalysisInput } from '../types';

function makeInput(articleCount: number, commentCount: number): AnalysisInput {
  return {
    jobId: 1,
    keyword: 'test',
    articles: Array.from({ length: articleCount }, (_, i) => ({
      title: `기사 제목 ${i}`,
      content: '가'.repeat(300),
      publisher: 'test',
      publishedAt: new Date(),
      source: 'naver-news',
    })),
    videos: [],
    comments: Array.from({ length: commentCount }, (_, i) => ({
      content: `댓글 ${i} 내용입니다`,
      source: 'youtube',
      author: 'u',
      likeCount: 10,
      dislikeCount: 0,
      publishedAt: new Date(),
    })),
    dateRange: { start: new Date(), end: new Date() },
  };
}

describe('estimateInputTokens', () => {
  it('기사 수에 비례', () => {
    const small = estimateInputTokens(makeInput(10, 0));
    const large = estimateInputTokens(makeInput(100, 0));
    expect(large).toBeGreaterThan(small);
  });

  it('최소 오버헤드 3000 토큰 포함', () => {
    const empty = estimateInputTokens(makeInput(0, 0));
    expect(empty).toBeGreaterThanOrEqual(3000);
  });
});

describe('predictPipelineCost', () => {
  it('모듈별 예상 비용 계산', () => {
    const input = makeInput(100, 500);
    const result = predictPipelineCost(input, [
      { name: 'macro-view', provider: 'gemini', model: 'gemini-2.5-flash' },
      { name: 'risk-map', provider: 'anthropic', model: 'claude-sonnet-4-6' },
    ]);

    expect(result.modules.length).toBe(2);
    expect(result.totalCostUsd).toBeGreaterThan(0);
    // Claude Sonnet이 Gemini Flash보다 비쌈
    expect(result.modules[1].estimatedCostUsd).toBeGreaterThan(result.modules[0].estimatedCostUsd);
  });
});

describe('suggestDowngrades', () => {
  it('예산 초과 시 비싼 모듈부터 다운그레이드 제안', () => {
    const input = makeInput(500, 2000);
    const prediction = predictPipelineCost(input, [
      { name: 'macro-view', provider: 'gemini', model: 'gemini-2.5-pro' },
      { name: 'risk-map', provider: 'anthropic', model: 'claude-opus-4-7' },
      { name: 'strategy', provider: 'anthropic', model: 'claude-opus-4-7' },
    ]);

    // 매우 낮은 예산 제시 → 모두 다운그레이드 필요
    const result = suggestDowngrades(prediction, 0.01);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.adjustedTotal).toBeLessThan(result.originalTotal);
  });

  it('예산 충분하면 다운그레이드 제안 없음', () => {
    const input = makeInput(10, 20);
    const prediction = predictPipelineCost(input, [
      { name: 'macro-view', provider: 'gemini', model: 'gemini-2.5-flash' },
    ]);
    const result = suggestDowngrades(prediction, 1000);
    expect(result.decisions.length).toBe(0);
    expect(result.withinBudget).toBe(true);
  });

  it('다운그레이드 불가 모델은 스킵', () => {
    const input = makeInput(100, 500);
    const prediction = predictPipelineCost(input, [
      { name: 'macro-view', provider: 'unknown', model: 'unknown-model' },
    ]);
    const result = suggestDowngrades(prediction, 0);
    // unknown-model은 DOWNGRADE_MAP에 없으므로 제안 없음
    expect(result.decisions.length).toBe(0);
  });
});
