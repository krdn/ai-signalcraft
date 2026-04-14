/**
 * context-distillation 테스트 — prompt-utils.ts의 distill* 함수들
 * Stage 2+ 모듈이 선행 결과를 맥락으로 주입할 때 사용하는 컨텍스트 추출 함수 검증
 */
import { describe, it, expect } from 'vitest';
import {
  distillForRiskMap,
  distillForOpportunity,
  distillForStrategy,
  distillForFinalSummary,
  distillForReputationRecovery,
} from '../prompt-utils';

// ─── distillForRiskMap 테스트 ────────────────────────────────────────

describe('distillForRiskMap', () => {
  it('선행 결과가 없으면 빈 문자열을 반환한다', () => {
    expect(distillForRiskMap({})).toBe('');
  });

  it('macro-view 결과가 있으면 해당 섹션이 포함된다', () => {
    const priorResults = {
      'macro-view': {
        overallDirection: '부정',
        summary: '여론이 악화되고 있음',
        inflectionPoints: ['1월 15일 이후 급락'],
      },
    };
    const result = distillForRiskMap(priorResults);
    expect(result).toContain('여론 흐름 요약 (macro-view)');
    expect(result).toContain('overallDirection');
  });

  it('segmentation 결과가 있으면 집단 구조 섹션이 포함된다', () => {
    const priorResults = {
      segmentation: {
        audienceGroups: [{ type: 'core', ratio: 0.3 }],
        highInfluenceGroup: 'opposition',
      },
    };
    const result = distillForRiskMap(priorResults);
    expect(result).toContain('집단 구조 (segmentation)');
  });

  it('sentiment-framing에서 negativeFrames를 포함한다 (distillForOpportunity와 다른 점)', () => {
    const priorResults = {
      'sentiment-framing': {
        sentimentRatio: { positive: 0.2, negative: 0.8 },
        negativeFrames: ['무능', '부패'],
        frameConflict: true,
      },
    };
    const result = distillForRiskMap(priorResults);
    expect(result).toContain('부정 감정·프레임 (sentiment-framing)');
    expect(result).toContain('negativeFrames');
  });

  it('message-impact에서 failureMessages를 포함한다', () => {
    const priorResults = {
      'message-impact': {
        failureMessages: ['실패 메시지 A'],
        highSpreadContentTypes: ['유튜브 쇼츠'],
      },
    };
    const result = distillForRiskMap(priorResults);
    expect(result).toContain('실패 메시지·확산 유형 (message-impact)');
  });

  it('모든 Stage 1 결과가 있으면 4개 섹션이 모두 포함된다', () => {
    const priorResults = {
      'macro-view': { overallDirection: '부정', summary: '악화', inflectionPoints: [] },
      segmentation: { audienceGroups: [], highInfluenceGroup: 'core' },
      'sentiment-framing': { sentimentRatio: {}, negativeFrames: [], frameConflict: false },
      'message-impact': { failureMessages: [], highSpreadContentTypes: [] },
    };
    const result = distillForRiskMap(priorResults);
    expect(result).toContain('여론 흐름 요약 (macro-view)');
    expect(result).toContain('집단 구조 (segmentation)');
    expect(result).toContain('부정 감정·프레임 (sentiment-framing)');
    expect(result).toContain('실패 메시지·확산 유형 (message-impact)');
  });

  it('관련 없는 모듈 키는 무시한다', () => {
    const priorResults = {
      'unknown-module': { someField: '값' },
    };
    expect(distillForRiskMap(priorResults)).toBe('');
  });
});

// ─── distillForOpportunity 테스트 ────────────────────────────────────

describe('distillForOpportunity', () => {
  it('선행 결과가 없으면 빈 문자열을 반환한다', () => {
    expect(distillForOpportunity({})).toBe('');
  });

  it('sentiment-framing에서 positiveFrames를 포함한다 (distillForRiskMap과 다른 점)', () => {
    const priorResults = {
      'sentiment-framing': {
        sentimentRatio: { positive: 0.6, negative: 0.4 },
        positiveFrames: ['리더십', '개혁'],
      },
    };
    const result = distillForOpportunity(priorResults);
    expect(result).toContain('긍정 감정·프레임 (sentiment-framing)');
    expect(result).toContain('positiveFrames');
  });

  it('message-impact에서 successMessages를 포함한다', () => {
    const priorResults = {
      'message-impact': {
        successMessages: ['성공 메시지 A'],
        highSpreadContentTypes: ['인스타그램 릴스'],
      },
    };
    const result = distillForOpportunity(priorResults);
    expect(result).toContain('성공 메시지·확산 유형 (message-impact)');
    expect(result).toContain('successMessages');
  });

  it('negativeFrames는 포함되지 않는다', () => {
    const priorResults = {
      'sentiment-framing': {
        sentimentRatio: {},
        negativeFrames: ['부패'],
        positiveFrames: ['청렴'],
      },
    };
    const result = distillForOpportunity(priorResults);
    // negativeFrames 키가 없어야 함 (extractField가 해당 필드를 요청하지 않음)
    expect(result).not.toContain('negativeFrames');
  });

  it('macro-view 결과가 있으면 여론 흐름 섹션이 포함된다', () => {
    const priorResults = {
      'macro-view': {
        overallDirection: '긍정',
        summary: '지지율 반등 중',
      },
    };
    const result = distillForOpportunity(priorResults);
    expect(result).toContain('여론 흐름 요약 (macro-view)');
    expect(result).toContain('overallDirection');
    // inflectionPoints는 distillForOpportunity에서 요청하지 않음
    expect(result).not.toContain('inflectionPoints');
  });

  it('segmentation 결과가 있으면 집단 구조 섹션이 포함된다', () => {
    const priorResults = {
      segmentation: {
        audienceGroups: [{ type: 'swing', ratio: 0.5 }],
        highInfluenceGroup: 'swing',
      },
    };
    const result = distillForOpportunity(priorResults);
    expect(result).toContain('집단 구조 (segmentation)');
    expect(result).toContain('highInfluenceGroup');
  });
});

// ─── distillForStrategy 테스트 ───────────────────────────────────────

describe('distillForStrategy', () => {
  it('선행 결과가 없으면 빈 문자열을 반환한다', () => {
    expect(distillForStrategy({})).toBe('');
  });

  it('risk-map 결과가 포함된다', () => {
    const priorResults = {
      'risk-map': {
        topRisks: [{ title: '리스크 A', level: 'high' }],
        overallRiskLevel: 'high',
      },
    };
    const result = distillForStrategy(priorResults);
    expect(result).toContain('리스크 (risk-map)');
  });

  it('opportunity 결과가 포함된다', () => {
    const priorResults = {
      opportunity: {
        positiveAssets: ['자산 A'],
        priorityOpportunity: '우선 기회',
      },
    };
    const result = distillForStrategy(priorResults);
    expect(result).toContain('기회 (opportunity)');
  });

  it('sentiment-framing에서 positiveFrames와 negativeFrames 모두 포함한다', () => {
    const priorResults = {
      'sentiment-framing': {
        sentimentRatio: { positive: 0.5 },
        positiveFrames: ['긍정'],
        negativeFrames: ['부정'],
        frameConflict: false,
      },
    };
    const result = distillForStrategy(priorResults);
    expect(result).toContain('감정·프레임 (sentiment-framing)');
    expect(result).toContain('positiveFrames');
    expect(result).toContain('negativeFrames');
  });

  it('macro-view 결과가 있으면 여론 방향 섹션이 포함된다', () => {
    const priorResults = {
      'macro-view': {
        overallDirection: '혼조',
        summary: '입장 분열 심화',
      },
    };
    const result = distillForStrategy(priorResults);
    expect(result).toContain('여론 방향 (macro-view)');
    expect(result).toContain('overallDirection');
  });

  it('segmentation 결과가 있으면 핵심 집단 섹션이 포함된다', () => {
    const priorResults = {
      segmentation: {
        audienceGroups: [{ type: 'core', ratio: 0.4 }],
        highInfluenceGroup: 'core',
      },
    };
    const result = distillForStrategy(priorResults);
    expect(result).toContain('핵심 집단 (segmentation)');
  });

  it('message-impact에서 successMessages와 failureMessages를 포함한다', () => {
    const priorResults = {
      'message-impact': {
        successMessages: ['성공 메시지 X'],
        failureMessages: ['실패 메시지 Y'],
      },
    };
    const result = distillForStrategy(priorResults);
    expect(result).toContain('메시지 성패 (message-impact)');
    expect(result).toContain('successMessages');
    expect(result).toContain('failureMessages');
  });
});

// ─── distillForFinalSummary 테스트 ───────────────────────────────────

describe('distillForFinalSummary', () => {
  it('선행 결과가 없으면 빈 문자열을 반환한다', () => {
    expect(distillForFinalSummary({})).toBe('');
  });

  it('6개 섹션 소스(macro-view, segmentation, sentiment-framing, risk-map, opportunity, strategy)를 처리한다', () => {
    const priorResults = {
      'macro-view': { overallDirection: '상승', summary: '개선 중', inflectionPoints: [] },
      segmentation: { highInfluenceGroup: 'swing' },
      'sentiment-framing': { sentimentRatio: { positive: 0.6 }, frameConflict: false },
      'risk-map': { topRisks: [], overallRiskLevel: 'low', riskTrend: 'stable' },
      opportunity: { priorityOpportunity: '청년층 결집' },
      strategy: {
        targetStrategy: '중도층 공략',
        messageStrategy: '희망 메시지',
        riskResponse: '선제 대응',
      },
    };
    const result = distillForFinalSummary(priorResults);
    expect(result).toContain('여론 흐름 (macro-view)');
    expect(result).toContain('핵심 집단 (segmentation)');
    expect(result).toContain('감정·프레임 핵심 (sentiment-framing)');
    expect(result).toContain('리스크 (risk-map)');
    expect(result).toContain('최우선 기회 (opportunity)');
    expect(result).toContain('전략 (strategy)');
  });

  it('segmentation에서 highInfluenceGroup만 추출한다', () => {
    const priorResults = {
      segmentation: {
        highInfluenceGroup: 'core',
        audienceGroups: [{ type: 'core' }], // audienceGroups는 포함 안 됨
      },
    };
    const result = distillForFinalSummary(priorResults);
    expect(result).toContain('highInfluenceGroup');
    // audienceGroups는 final-summary 용 distill에 포함되지 않음
    // (extractField가 'highInfluenceGroup'만 요청)
  });
});

// ─── distillForReputationRecovery 테스트 ─────────────────────────────

describe('distillForReputationRecovery', () => {
  it('선행 결과가 없으면 fallback 문자열을 반환한다', () => {
    const result = distillForReputationRecovery({});
    expect(result).toBe('선행 분석 데이터 없음 — 기사/댓글 데이터 기반으로 분석');
  });

  it('reputation-index overallScore가 있으면 평판 기반선 섹션이 포함된다', () => {
    const priorResults = {
      'reputation-index': {
        overallScore: 72,
        summary: '전반적으로 긍정적이나 일부 이슈 존재',
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('현재 평판 기반선 (reputation-index)');
    expect(result).toContain('72/100');
    expect(result).toContain('전반적으로 긍정적이나 일부 이슈 존재');
  });

  it('crisis-type-classifier crisisType이 있으면 위기 유형 섹션이 포함된다', () => {
    const priorResults = {
      'crisis-type-classifier': {
        crisisType: 'preventable',
        crisisTypeName: '예방 가능한 위기',
        responsibilityLevel: 'high',
        recommendedStrategies: [{ strategyName: '사과 및 시정조치' }],
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('위기 유형 분류 (crisis-type-classifier)');
    expect(result).toContain('예방 가능한 위기');
    expect(result).toContain('1순위 권고 전략: 사과 및 시정조치');
  });

  it('crisis-scenario scenarios에서 spread 타입이 있으면 우선 선택한다', () => {
    const priorResults = {
      'crisis-scenario': {
        scenarios: [
          { title: '유지 시나리오', type: 'maintain', probability: 30 },
          { title: '확산 시나리오', type: 'spread', probability: 55 },
        ],
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('확산 시나리오');
    expect(result).toContain('55%');
  });

  it('spread 타입이 없으면 scenarios[0]을 사용한다', () => {
    const priorResults = {
      'crisis-scenario': {
        scenarios: [{ title: '첫 번째 시나리오', type: 'maintain', probability: 40 }],
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('첫 번째 시나리오');
    expect(result).toContain('40%');
  });

  it('risk-map topRisks 최대 3개만 포함한다', () => {
    const priorResults = {
      'risk-map': {
        topRisks: [
          { title: '리스크 1', description: '설명 1' },
          { title: '리스크 2', description: '설명 2' },
          { title: '리스크 3', description: '설명 3' },
          { title: '리스크 4', description: '설명 4' }, // 이것은 포함되지 않아야 함
        ],
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('리스크 1');
    expect(result).toContain('리스크 2');
    expect(result).toContain('리스크 3');
    expect(result).not.toContain('리스크 4');
  });

  it('부분 데이터(reputation-index만)가 있어도 fallback이 아닌 정상 결과를 반환한다', () => {
    const priorResults = {
      'reputation-index': { overallScore: 60 },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).not.toBe('선행 분석 데이터 없음 — 기사/댓글 데이터 기반으로 분석');
    expect(result).toContain('60/100');
  });

  it('stakeholder-map criticalStakeholder가 있으면 이해관계자 섹션이 포함된다', () => {
    const priorResults = {
      'stakeholder-map': {
        criticalStakeholder: '소비자 단체',
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('핵심 이해관계자 (stakeholder-map)');
    expect(result).toContain('소비자 단체');
  });

  it('esg-sentiment overallScore가 있으면 ESG 회복 가능성 섹션이 포함된다', () => {
    const priorResults = {
      'esg-sentiment': {
        overallScore: 65,
        regulatoryRisk: 'medium',
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('ESG 회복 가능성 (esg-sentiment)');
    expect(result).toContain('ESG 종합 점수: 65');
    expect(result).toContain('규제 리스크: medium');
  });

  it('esg-sentiment regulatoryRisk만 있어도 ESG 섹션이 포함된다', () => {
    const priorResults = {
      'esg-sentiment': {
        regulatoryRisk: 'high',
      },
    };
    const result = distillForReputationRecovery(priorResults);
    expect(result).toContain('ESG 회복 가능성 (esg-sentiment)');
    expect(result).toContain('규제 리스크: high');
    // overallScore가 없으면 해당 줄은 포함되지 않음
    expect(result).not.toContain('ESG 종합 점수');
  });
});
