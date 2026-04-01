import { describe, it, expect } from 'vitest';
import type { AnalysisInput } from '../src/analysis/types';

// 테스트용 mock 데이터
const mockInput: AnalysisInput = {
  jobId: 1,
  keyword: '테스트 키워드',
  articles: [
    {
      title: '테스트 기사',
      content: '테스트 내용',
      publisher: '테스트 매체',
      publishedAt: new Date('2026-01-01'),
      source: 'naver',
    },
  ],
  videos: [
    {
      title: '테스트 영상',
      description: '테스트 설명',
      channelTitle: '테스트 채널',
      viewCount: 1000,
      likeCount: 100,
      publishedAt: new Date('2026-01-01'),
    },
  ],
  comments: [
    {
      content: '테스트 댓글',
      source: 'naver',
      author: '테스트 유저',
      likeCount: 10,
      dislikeCount: 0,
      publishedAt: new Date('2026-01-01'),
    },
  ],
  dateRange: { start: new Date('2026-01-01'), end: new Date('2026-01-07') },
};

const mockPriorResults: Record<string, unknown> = {
  'macro-view': { overallDirection: 'positive', summary: '전반적으로 긍정적' },
  segmentation: { platformSegments: [] },
  'sentiment-framing': { sentimentRatio: { positive: 0.6, negative: 0.3, neutral: 0.1 } },
  'message-impact': { successMessages: ['좋은 메시지'] },
  'risk-map': { topRisks: [], overallRiskLevel: 'medium', riskTrend: 'stable' },
  opportunity: {
    positiveAssets: [],
    untappedAreas: [],
    priorityOpportunity: { title: 'test', reason: 'test', actionPlan: 'test' },
  },
};

describe('Stage 2 분석 모듈', () => {
  describe('riskMapModule', () => {
    it('name이 "risk-map"이고 provider가 "anthropic"이다', async () => {
      const { riskMapModule } = await import('../src/analysis/modules/risk-map');
      expect(riskMapModule.name).toBe('risk-map');
      expect(riskMapModule.provider).toBe('anthropic');
    });

    it('buildPromptWithContext 메서드가 존재한다', async () => {
      const { riskMapModule } = await import('../src/analysis/modules/risk-map');
      expect(riskMapModule.buildPromptWithContext).toBeDefined();
      expect(typeof riskMapModule.buildPromptWithContext).toBe('function');
    });

    it('buildPromptWithContext가 priorResults 내용을 포함한 문자열을 반환한다', async () => {
      const { riskMapModule } = await import('../src/analysis/modules/risk-map');
      const prompt = riskMapModule.buildPromptWithContext!(mockInput, mockPriorResults);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      // 선행 분석 결과가 포함되어야 함
      expect(prompt).toContain('macro-view');
    });
  });

  describe('opportunityModule', () => {
    it('name이 "opportunity"이고 provider가 "anthropic"이다', async () => {
      const { opportunityModule } = await import('../src/analysis/modules/opportunity');
      expect(opportunityModule.name).toBe('opportunity');
      expect(opportunityModule.provider).toBe('anthropic');
    });

    it('buildPromptWithContext 메서드가 존재한다', async () => {
      const { opportunityModule } = await import('../src/analysis/modules/opportunity');
      expect(opportunityModule.buildPromptWithContext).toBeDefined();
      expect(typeof opportunityModule.buildPromptWithContext).toBe('function');
    });
  });

  describe('strategyModule', () => {
    it('name이 "strategy"이고 provider가 "anthropic"이다', async () => {
      const { strategyModule } = await import('../src/analysis/modules/strategy');
      expect(strategyModule.name).toBe('strategy');
      expect(strategyModule.provider).toBe('anthropic');
    });

    it('buildPromptWithContext 메서드가 존재한다', async () => {
      const { strategyModule } = await import('../src/analysis/modules/strategy');
      expect(strategyModule.buildPromptWithContext).toBeDefined();
      expect(typeof strategyModule.buildPromptWithContext).toBe('function');
    });

    it('buildPromptWithContext가 risk-map, opportunity 결과를 참조한다', async () => {
      const { strategyModule } = await import('../src/analysis/modules/strategy');
      const prompt = strategyModule.buildPromptWithContext!(mockInput, mockPriorResults);
      expect(prompt).toContain('risk-map');
      expect(prompt).toContain('opportunity');
    });
  });

  describe('finalSummaryModule', () => {
    it('name이 "final-summary"이고 provider가 "anthropic"이다', async () => {
      const { finalSummaryModule } = await import('../src/analysis/modules/final-summary');
      expect(finalSummaryModule.name).toBe('final-summary');
      expect(finalSummaryModule.provider).toBe('anthropic');
    });

    it('buildPromptWithContext 메서드가 존재한다', async () => {
      const { finalSummaryModule } = await import('../src/analysis/modules/final-summary');
      expect(finalSummaryModule.buildPromptWithContext).toBeDefined();
      expect(typeof finalSummaryModule.buildPromptWithContext).toBe('function');
    });
  });
});

describe('Stage 2 Zod 스키마', () => {
  it('RiskMapSchema.parse(validData)가 성공한다', async () => {
    const { RiskMapSchema } = await import('../src/analysis/schemas/risk-map.schema');
    const validData = {
      topRisks: [
        {
          rank: 1,
          title: '테스트 리스크',
          description: '리스크 설명',
          impactLevel: 'high' as const,
          spreadProbability: 0.7,
          currentStatus: '진행 중',
          triggerConditions: ['조건1', '조건2'],
        },
      ],
      overallRiskLevel: 'medium' as const,
      riskTrend: 'stable' as const,
    };
    const result = RiskMapSchema.parse(validData);
    expect(result.topRisks).toHaveLength(1);
    expect(result.overallRiskLevel).toBe('medium');
  });

  it('OpportunitySchema.parse(validData)가 성공한다', async () => {
    const { OpportunitySchema } = await import('../src/analysis/schemas/opportunity.schema');
    const validData = {
      positiveAssets: [
        {
          title: '긍정 요소',
          description: '설명',
          expandability: 'high' as const,
          currentUtilization: 'partially' as const,
          recommendation: '추천',
        },
      ],
      untappedAreas: [{ area: '미활용 영역', potential: '잠재력', approach: '접근법' }],
      priorityOpportunity: {
        title: '최우선 기회',
        reason: '이유',
        actionPlan: '실행 계획',
      },
    };
    const result = OpportunitySchema.parse(validData);
    expect(result.positiveAssets).toHaveLength(1);
  });

  it('StrategySchema.parse(validData)가 성공한다', async () => {
    const { StrategySchema } = await import('../src/analysis/schemas/strategy.schema');
    const validData = {
      targetStrategy: {
        primaryTarget: '주요 타겟',
        secondaryTargets: ['보조 타겟1'],
        approach: '접근법',
      },
      messageStrategy: {
        coreMessage: '핵심 메시지',
        supportingMessages: ['보조 메시지1'],
        toneAndManner: '톤앤매너',
      },
      contentStrategy: {
        recommendedFormats: ['숏폼'],
        keyTopics: ['주제1'],
        distributionChannels: ['유튜브'],
      },
      riskResponse: {
        immediateActions: ['즉시 조치1'],
        preventiveActions: ['예방 조치1'],
        contingencyPlan: '비상 계획',
      },
    };
    const result = StrategySchema.parse(validData);
    expect(result.targetStrategy.primaryTarget).toBe('주요 타겟');
  });

  it('FinalSummarySchema에 oneLiner 필드가 존재한다', async () => {
    const { FinalSummarySchema } = await import('../src/analysis/schemas/final-summary.schema');
    const validData = {
      oneLiner: '한 줄 요약',
      currentState: {
        summary: '현재 상태 요약',
        sentiment: 'mixed' as const,
        keyFactor: '핵심 변수',
      },
      criticalActions: [
        {
          priority: 1,
          action: '실행 과제',
          expectedImpact: '기대 효과',
          timeline: '1주 이내',
        },
      ],
      outlook: {
        shortTerm: '단기 전망',
        mediumTerm: '중기 전망',
        keyVariable: '핵심 변수',
      },
    };
    const result = FinalSummarySchema.parse(validData);
    expect(result.oneLiner).toBe('한 줄 요약');
  });
});
