import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

describe('ADVN-01: ApprovalRatingSchema', () => {
  it('유효한 데이터를 파싱할 수 있다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas/approval-rating.schema');

    const validData = {
      estimatedRange: { min: 35, max: 42 },
      confidence: 'medium' as const,
      methodology: {
        sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
        platformBiasCorrection: [
          { platform: '네이버 뉴스', biasDirection: 'right' as const, correctionFactor: 0.85 },
          { platform: '유튜브', biasDirection: 'left' as const, correctionFactor: 1.1 },
        ],
        spreadFactor: 0.7,
      },
      disclaimer: '이 추정치는 AI 분석 기반 참고용이며, 과학적 여론조사를 대체하지 않습니다.',
      reasoning: '긍정 감정 비율 40%와 플랫폼 편향 보정을 적용하여 범위를 산출했습니다.',
    };

    const result = ApprovalRatingSchema.parse(validData);
    expect(result.estimatedRange.min).toBe(35);
    expect(result.estimatedRange.max).toBe(42);
  });

  it('estimatedRange.min/max가 0~100 범위를 벗어나면 실패한다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas/approval-rating.schema');

    expect(() => ApprovalRatingSchema.parse({
      estimatedRange: { min: -5, max: 42 },
      confidence: 'medium',
      methodology: {
        sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
        platformBiasCorrection: [],
        spreadFactor: 0.7,
      },
      disclaimer: '면책 문구',
      reasoning: '이유',
    })).toThrow(ZodError);
  });

  it('disclaimer 필드가 string 타입으로 존재한다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas/approval-rating.schema');

    // disclaimer 없으면 실패
    expect(() => ApprovalRatingSchema.parse({
      estimatedRange: { min: 35, max: 42 },
      confidence: 'medium',
      methodology: {
        sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
        platformBiasCorrection: [],
        spreadFactor: 0.7,
      },
      reasoning: '이유',
    })).toThrow(ZodError);
  });

  it('confidence 필드가 high|medium|low enum이다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas/approval-rating.schema');

    expect(() => ApprovalRatingSchema.parse({
      estimatedRange: { min: 35, max: 42 },
      confidence: 'invalid',
      methodology: {
        sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
        platformBiasCorrection: [],
        spreadFactor: 0.7,
      },
      disclaimer: '면책 문구',
      reasoning: '이유',
    })).toThrow(ZodError);
  });
});

describe('ADVN-02: FrameWarSchema', () => {
  it('유효한 데이터를 파싱할 수 있다', async () => {
    const { FrameWarSchema } = await import('../src/analysis/schemas/frame-war.schema');

    const validData = {
      dominantFrames: [
        {
          name: '경제 성과 프레임',
          description: '경제 지표 개선을 강조',
          strength: 75,
          supportingEvidence: ['GDP 성장률 보도', '고용 지표 개선 기사'],
        },
      ],
      threateningFrames: [
        {
          name: '도덕성 프레임',
          description: '윤리적 문제 제기',
          threatLevel: 'high' as const,
          counterStrategy: '투명성 강화 대응',
        },
      ],
      reversibleFrames: [
        {
          name: '세대 갈등 프레임',
          currentPerception: '기성세대 편향',
          potentialShift: '청년 정책 통한 반전',
          requiredAction: '청년 타겟 정책 발표',
        },
      ],
      battlefieldSummary: '경제 프레임이 지배적이나 도덕성 프레임의 위협이 증가 추세',
    };

    const result = FrameWarSchema.parse(validData);
    expect(result.dominantFrames).toHaveLength(1);
    expect(result.threateningFrames).toHaveLength(1);
    expect(result.reversibleFrames).toHaveLength(1);
  });

  it('잘못된 입력에 ZodError를 throw한다', async () => {
    const { FrameWarSchema } = await import('../src/analysis/schemas/frame-war.schema');

    // strength가 0~100 범위 밖
    expect(() => FrameWarSchema.parse({
      dominantFrames: [{ name: 'test', description: 'test', strength: 150, supportingEvidence: [] }],
      threateningFrames: [],
      reversibleFrames: [],
      battlefieldSummary: 'test',
    })).toThrow(ZodError);
  });
});

describe('ADVN-03: CrisisScenarioSchema', () => {
  it('유효한 데이터를 파싱할 수 있다 (3개 시나리오: spread/control/reverse)', async () => {
    const { CrisisScenarioSchema } = await import('../src/analysis/schemas/crisis-scenario.schema');

    const validData = {
      scenarios: [
        {
          type: 'spread' as const,
          name: '위기 확산 시나리오',
          probability: 30,
          triggerConditions: ['추가 폭로', '야당 공세 강화'],
          expectedOutcome: '지지율 10% 하락',
          responseStrategy: ['신속 대응팀 구성', '사실 관계 정리'],
          timeframe: '1~2주',
        },
        {
          type: 'control' as const,
          name: '위기 통제 시나리오',
          probability: 50,
          triggerConditions: ['미디어 관심 감소', '이슈 대체'],
          expectedOutcome: '현재 수준 유지',
          responseStrategy: ['적극 해명', '의제 전환'],
          timeframe: '2~4주',
        },
        {
          type: 'reverse' as const,
          name: '위기 역전 시나리오',
          probability: 20,
          triggerConditions: ['유리한 사실 확인', '여론 반전'],
          expectedOutcome: '지지율 5% 반등',
          responseStrategy: ['적극 공세', '성과 홍보'],
          timeframe: '3~6주',
        },
      ],
      currentRiskLevel: 'medium' as const,
      recommendedAction: '현재 통제 시나리오에 집중하되 확산 대비 필요',
    };

    const result = CrisisScenarioSchema.parse(validData);
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios[0].type).toBe('spread');
    expect(result.scenarios[1].type).toBe('control');
    expect(result.scenarios[2].type).toBe('reverse');
  });

  it('시나리오 타입이 맞지 않으면 실패한다', async () => {
    const { CrisisScenarioSchema } = await import('../src/analysis/schemas/crisis-scenario.schema');

    expect(() => CrisisScenarioSchema.parse({
      scenarios: [
        { type: 'wrong', name: 'test', probability: 30, triggerConditions: [], expectedOutcome: 'test', responseStrategy: [], timeframe: '1주' },
        { type: 'control', name: 'test', probability: 50, triggerConditions: [], expectedOutcome: 'test', responseStrategy: [], timeframe: '2주' },
        { type: 'reverse', name: 'test', probability: 20, triggerConditions: [], expectedOutcome: 'test', responseStrategy: [], timeframe: '3주' },
      ],
      currentRiskLevel: 'medium',
      recommendedAction: 'test',
    })).toThrow(ZodError);
  });
});

describe('ADVN-04: WinSimulationSchema', () => {
  it('유효한 데이터를 파싱할 수 있다', async () => {
    const { WinSimulationSchema } = await import('../src/analysis/schemas/win-simulation.schema');

    const validData = {
      winProbability: 55,
      confidenceLevel: 'medium' as const,
      winConditions: [
        { condition: '경제 지표 개선 지속', currentStatus: 'partial' as const, importance: 'critical' as const },
        { condition: '청년 정책 호응', currentStatus: 'unmet' as const, importance: 'high' as const },
        { condition: '중도층 확보', currentStatus: 'partial' as const, importance: 'critical' as const },
      ],
      loseConditions: [
        { condition: '추가 스캔들 발생', currentRisk: 'medium' as const, mitigation: '위기 대응 체계 강화' },
        { condition: '경제 악화', currentRisk: 'low' as const, mitigation: '경제 성과 지속 홍보' },
      ],
      keyStrategies: [
        { strategy: '중도층 타겟 메시지', expectedImpact: '지지율 3~5% 상승', priority: 1 },
        { strategy: '청년 정책 패키지', expectedImpact: '2030 지지율 개선', priority: 2 },
        { strategy: '경제 성과 홍보', expectedImpact: '이탈 방지', priority: 3 },
      ],
      simulationSummary: '현재 승리 확률 55%로 경합 상태. 중도층 확보가 핵심 변수.',
    };

    const result = WinSimulationSchema.parse(validData);
    expect(result.winProbability).toBe(55);
    expect(result.winConditions.length).toBeGreaterThanOrEqual(3);
    expect(result.loseConditions.length).toBeGreaterThanOrEqual(2);
  });

  it('winProbability가 0~100 범위를 벗어나면 실패한다', async () => {
    const { WinSimulationSchema } = await import('../src/analysis/schemas/win-simulation.schema');

    expect(() => WinSimulationSchema.parse({
      winProbability: 150,
      confidenceLevel: 'medium',
      winConditions: [
        { condition: 'a', currentStatus: 'met', importance: 'critical' },
        { condition: 'b', currentStatus: 'met', importance: 'high' },
        { condition: 'c', currentStatus: 'met', importance: 'medium' },
      ],
      loseConditions: [
        { condition: 'x', currentRisk: 'high', mitigation: 'y' },
        { condition: 'z', currentRisk: 'low', mitigation: 'w' },
      ],
      keyStrategies: [
        { strategy: 'a', expectedImpact: 'b', priority: 1 },
        { strategy: 'c', expectedImpact: 'd', priority: 2 },
        { strategy: 'e', expectedImpact: 'f', priority: 3 },
      ],
      simulationSummary: 'test',
    })).toThrow(ZodError);
  });

  it('winConditions가 3개 미만이면 실패한다', async () => {
    const { WinSimulationSchema } = await import('../src/analysis/schemas/win-simulation.schema');

    expect(() => WinSimulationSchema.parse({
      winProbability: 50,
      confidenceLevel: 'medium',
      winConditions: [
        { condition: 'a', currentStatus: 'met', importance: 'critical' },
      ],
      loseConditions: [
        { condition: 'x', currentRisk: 'high', mitigation: 'y' },
        { condition: 'z', currentRisk: 'low', mitigation: 'w' },
      ],
      keyStrategies: [
        { strategy: 'a', expectedImpact: 'b', priority: 1 },
        { strategy: 'c', expectedImpact: 'd', priority: 2 },
        { strategy: 'e', expectedImpact: 'f', priority: 3 },
      ],
      simulationSummary: 'test',
    })).toThrow(ZodError);
  });
});

describe('ADVN 모듈 export 확인', () => {
  it('4개 모듈이 modules/index.ts에서 export된다', async () => {
    const mods = await import('../src/analysis/modules/index');
    expect(mods.approvalRatingModule).toBeDefined();
    expect(mods.frameWarModule).toBeDefined();
    expect(mods.crisisScenarioModule).toBeDefined();
    expect(mods.winSimulationModule).toBeDefined();
  });

  it('4개 스키마가 schemas/index.ts에서 export된다', async () => {
    const schemas = await import('../src/analysis/schemas/index');
    expect(schemas.ApprovalRatingSchema).toBeDefined();
    expect(schemas.FrameWarSchema).toBeDefined();
    expect(schemas.CrisisScenarioSchema).toBeDefined();
    expect(schemas.WinSimulationSchema).toBeDefined();
  });

  it('MODULE_MODEL_MAP이 4개 ADVN 모듈 매핑을 포함한다', async () => {
    const { MODULE_MODEL_MAP } = await import('../src/analysis/types');
    const advnModules = ['approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation'];

    for (const mod of advnModules) {
      expect(MODULE_MODEL_MAP[mod]).toBeDefined();
      expect(MODULE_MODEL_MAP[mod].provider).toBe('anthropic');
      expect(MODULE_MODEL_MAP[mod].model).toBe('claude-sonnet-4-20250514');
    }
  });

  it('MODULE_NAMES에 4개 ADVN 이름 상수가 포함된다', async () => {
    const { MODULE_NAMES } = await import('../src/analysis/types');
    expect(MODULE_NAMES.APPROVAL_RATING).toBe('approval-rating');
    expect(MODULE_NAMES.FRAME_WAR).toBe('frame-war');
    expect(MODULE_NAMES.CRISIS_SCENARIO).toBe('crisis-scenario');
    expect(MODULE_NAMES.WIN_SIMULATION).toBe('win-simulation');
  });
});
