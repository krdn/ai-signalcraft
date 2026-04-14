// ─── 컨텍스트 선별 주입 (Context Distillation) ──────────────────────

type PriorResults = Record<string, unknown>;

/** 선행 결과에서 안전하게 필드를 추출 */
function extractField(results: PriorResults, module: string, ...fields: string[]): unknown {
  const moduleResult = results[module];
  if (!moduleResult || typeof moduleResult !== 'object') return undefined;

  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = (moduleResult as Record<string, unknown>)[field];
    if (value !== undefined) result[field] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** risk-map용: Stage 1에서 핵심 필드만 추출 */
export function distillForRiskMap(priorResults: PriorResults): string {
  const sections: string[] = [];

  const macroView = extractField(
    priorResults,
    'macro-view',
    'overallDirection',
    'summary',
    'inflectionPoints',
  );
  if (macroView)
    sections.push(`### 여론 흐름 요약 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  const segmentation = extractField(
    priorResults,
    'segmentation',
    'audienceGroups',
    'highInfluenceGroup',
  );
  if (segmentation)
    sections.push(`### 집단 구조 (segmentation)\n${JSON.stringify(segmentation, null, 2)}`);

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'negativeFrames',
    'frameConflict',
  );
  if (sentiment)
    sections.push(
      `### 부정 감정·프레임 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`,
    );

  const impact = extractField(
    priorResults,
    'message-impact',
    'failureMessages',
    'highSpreadContentTypes',
  );
  if (impact)
    sections.push(`### 실패 메시지·확산 유형 (message-impact)\n${JSON.stringify(impact, null, 2)}`);

  return sections.join('\n\n');
}

/** opportunity용: Stage 1에서 긍정 신호만 추출 */
export function distillForOpportunity(priorResults: PriorResults): string {
  const sections: string[] = [];

  const macroView = extractField(priorResults, 'macro-view', 'overallDirection', 'summary');
  if (macroView)
    sections.push(`### 여론 흐름 요약 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  const segmentation = extractField(
    priorResults,
    'segmentation',
    'audienceGroups',
    'highInfluenceGroup',
  );
  if (segmentation)
    sections.push(`### 집단 구조 (segmentation)\n${JSON.stringify(segmentation, null, 2)}`);

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'positiveFrames',
  );
  if (sentiment)
    sections.push(
      `### 긍정 감정·프레임 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`,
    );

  const impact = extractField(
    priorResults,
    'message-impact',
    'successMessages',
    'highSpreadContentTypes',
  );
  if (impact)
    sections.push(`### 성공 메시지·확산 유형 (message-impact)\n${JSON.stringify(impact, null, 2)}`);

  return sections.join('\n\n');
}

/** strategy용: Stage 1 + risk-map + opportunity 핵심 필드 */
export function distillForStrategy(priorResults: PriorResults): string {
  const sections: string[] = [];

  const macroView = extractField(priorResults, 'macro-view', 'overallDirection', 'summary');
  if (macroView) sections.push(`### 여론 방향 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  const segmentation = extractField(
    priorResults,
    'segmentation',
    'audienceGroups',
    'highInfluenceGroup',
  );
  if (segmentation)
    sections.push(`### 핵심 집단 (segmentation)\n${JSON.stringify(segmentation, null, 2)}`);

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'positiveFrames',
    'negativeFrames',
    'frameConflict',
  );
  if (sentiment)
    sections.push(`### 감정·프레임 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`);

  const impact = extractField(priorResults, 'message-impact', 'successMessages', 'failureMessages');
  if (impact) sections.push(`### 메시지 성패 (message-impact)\n${JSON.stringify(impact, null, 2)}`);

  const riskMap = extractField(priorResults, 'risk-map', 'topRisks', 'overallRiskLevel');
  if (riskMap) sections.push(`### 리스크 (risk-map)\n${JSON.stringify(riskMap, null, 2)}`);

  const opportunity = extractField(
    priorResults,
    'opportunity',
    'positiveAssets',
    'priorityOpportunity',
  );
  if (opportunity) sections.push(`### 기회 (opportunity)\n${JSON.stringify(opportunity, null, 2)}`);

  return sections.join('\n\n');
}

/** final-summary용: 전체 결과에서 핵심만 */
export function distillForFinalSummary(priorResults: PriorResults): string {
  const sections: string[] = [];

  const macroView = extractField(
    priorResults,
    'macro-view',
    'overallDirection',
    'summary',
    'inflectionPoints',
  );
  if (macroView) sections.push(`### 여론 흐름 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  const segmentation = extractField(priorResults, 'segmentation', 'highInfluenceGroup');
  if (segmentation)
    sections.push(`### 핵심 집단 (segmentation)\n${JSON.stringify(segmentation, null, 2)}`);

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'frameConflict',
  );
  if (sentiment)
    sections.push(
      `### 감정·프레임 핵심 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`,
    );

  const riskMap = extractField(
    priorResults,
    'risk-map',
    'topRisks',
    'overallRiskLevel',
    'riskTrend',
  );
  if (riskMap) sections.push(`### 리스크 (risk-map)\n${JSON.stringify(riskMap, null, 2)}`);

  const opportunity = extractField(priorResults, 'opportunity', 'priorityOpportunity');
  if (opportunity)
    sections.push(`### 최우선 기회 (opportunity)\n${JSON.stringify(opportunity, null, 2)}`);

  const strategy = extractField(
    priorResults,
    'strategy',
    'targetStrategy',
    'messageStrategy',
    'riskResponse',
  );
  if (strategy) sections.push(`### 전략 (strategy)\n${JSON.stringify(strategy, null, 2)}`);

  return sections.join('\n\n');
}

/** approval-rating용: 감정/집단 데이터만 */
export function distillForApprovalRating(priorResults: PriorResults): string {
  const sections: string[] = [];

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'topKeywords',
  );
  if (sentiment)
    sections.push(
      `### 감정 비율·키워드 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`,
    );

  const segmentation = extractField(
    priorResults,
    'segmentation',
    'platformSegments',
    'audienceGroups',
  );
  if (segmentation)
    sections.push(
      `### 플랫폼·집단별 반응 (segmentation)\n${JSON.stringify(segmentation, null, 2)}`,
    );

  const macroView = extractField(
    priorResults,
    'macro-view',
    'overallDirection',
    'dailyMentionTrend',
  );
  if (macroView) sections.push(`### 여론 추이 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  return sections.join('\n\n');
}

/** frame-war용: 프레임 관련 데이터만 */
export function distillForFrameWar(priorResults: PriorResults): string {
  const sections: string[] = [];

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'positiveFrames',
    'negativeFrames',
    'frameConflict',
    'topKeywords',
  );
  if (sentiment)
    sections.push(`### 프레임·키워드 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`);

  const macroView = extractField(
    priorResults,
    'macro-view',
    'overallDirection',
    'inflectionPoints',
  );
  if (macroView)
    sections.push(`### 여론 변곡점 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  const impact = extractField(priorResults, 'message-impact', 'successMessages', 'failureMessages');
  if (impact) sections.push(`### 메시지 성패 (message-impact)\n${JSON.stringify(impact, null, 2)}`);

  return sections.join('\n\n');
}

/** crisis-scenario용: 리스크+지지율 중심 */
export function distillForCrisisScenario(priorResults: PriorResults): string {
  const sections: string[] = [];

  const riskMap = extractField(
    priorResults,
    'risk-map',
    'topRisks',
    'overallRiskLevel',
    'riskTrend',
  );
  if (riskMap) sections.push(`### 리스크 (risk-map)\n${JSON.stringify(riskMap, null, 2)}`);

  const approval = extractField(
    priorResults,
    'approval-rating',
    'estimatedRange',
    'confidence',
    'methodology',
  );
  if (approval)
    sections.push(`### 지지율 추정 (approval-rating)\n${JSON.stringify(approval, null, 2)}`);

  const macroView = extractField(
    priorResults,
    'macro-view',
    'overallDirection',
    'inflectionPoints',
  );
  if (macroView)
    sections.push(`### 여론 변곡점 (macro-view)\n${JSON.stringify(macroView, null, 2)}`);

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'negativeFrames',
  );
  if (sentiment)
    sections.push(`### 부정 감정 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`);

  return sections.join('\n\n');
}

/** win-simulation용: 모든 결과에서 핵심만 */
export function distillForWinSimulation(priorResults: PriorResults): string {
  const sections: string[] = [];

  const approval = extractField(priorResults, 'approval-rating', 'estimatedRange', 'confidence');
  if (approval)
    sections.push(`### 지지율 추정 (approval-rating)\n${JSON.stringify(approval, null, 2)}`);

  const riskMap = extractField(priorResults, 'risk-map', 'topRisks', 'overallRiskLevel');
  if (riskMap) sections.push(`### 리스크 (risk-map)\n${JSON.stringify(riskMap, null, 2)}`);

  const opportunity = extractField(
    priorResults,
    'opportunity',
    'positiveAssets',
    'priorityOpportunity',
  );
  if (opportunity) sections.push(`### 기회 (opportunity)\n${JSON.stringify(opportunity, null, 2)}`);

  const strategy = extractField(
    priorResults,
    'strategy',
    'targetStrategy',
    'messageStrategy',
    'riskResponse',
  );
  if (strategy) sections.push(`### 전략 (strategy)\n${JSON.stringify(strategy, null, 2)}`);

  const frameWar = extractField(
    priorResults,
    'frame-war',
    'dominantFrames',
    'threateningFrames',
    'battlefieldSummary',
  );
  if (frameWar) sections.push(`### 프레임 전쟁 (frame-war)\n${JSON.stringify(frameWar, null, 2)}`);

  const crisis = extractField(priorResults, 'crisis-scenario', 'scenarios', 'currentRiskLevel');
  if (crisis)
    sections.push(`### 위기 시나리오 (crisis-scenario)\n${JSON.stringify(crisis, null, 2)}`);

  const sentiment = extractField(
    priorResults,
    'sentiment-framing',
    'sentimentRatio',
    'frameConflict',
  );
  if (sentiment)
    sections.push(`### 감정·프레임 (sentiment-framing)\n${JSON.stringify(sentiment, null, 2)}`);

  const segmentation = extractField(priorResults, 'segmentation', 'highInfluenceGroup');
  if (segmentation)
    sections.push(`### 핵심 집단 (segmentation)\n${JSON.stringify(segmentation, null, 2)}`);

  return sections.join('\n\n');
}

/**
 * reputation-recovery-simulation 모듈용 컨텍스트 추출
 * 선행 6개 모듈 결과에서 핵심 데이터를 종합
 */
export function distillForReputationRecovery(priorResults: PriorResults): string {
  const reputationIndex = priorResults['reputation-index'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const crisisTypeClassifier = priorResults['crisis-type-classifier'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const stakeholderMap = priorResults['stakeholder-map'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const esgSentiment = priorResults['esg-sentiment'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const crisisScenario = priorResults['crisis-scenario'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const riskMap = priorResults['risk-map'] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const lines: string[] = [];

  // 기반선 점수
  if (reputationIndex?.overallScore !== undefined) {
    lines.push(`### 현재 평판 기반선 (reputation-index)`);
    lines.push(`- 종합 점수: ${reputationIndex.overallScore}/100`);
    if (reputationIndex.summary) lines.push(`- 요약: ${reputationIndex.summary}`);
  }

  // 위기 유형 (SCCT 회복 전략 가중치)
  if (crisisTypeClassifier?.crisisType) {
    lines.push(`\n### 위기 유형 분류 (crisis-type-classifier)`);
    lines.push(
      `- 위기 유형: ${crisisTypeClassifier.crisisType} (${crisisTypeClassifier.crisisTypeName ?? ''})`,
    );
    lines.push(`- 책임 귀속 수준: ${crisisTypeClassifier.responsibilityLevel}`);
    if (crisisTypeClassifier.recommendedStrategies?.length) {
      const top = crisisTypeClassifier.recommendedStrategies[0];
      lines.push(`- 1순위 권고 전략: ${top.strategyName ?? top.strategy}`);
    }
  }

  // 핵심 이해관계자
  if (stakeholderMap?.criticalStakeholder ?? stakeholderMap?.stakeholders) {
    lines.push(`\n### 핵심 이해관계자 (stakeholder-map)`);
    const critical = stakeholderMap.criticalStakeholder ?? stakeholderMap.stakeholders?.[0];
    if (critical)
      lines.push(
        `- 최우선 이해관계자: ${typeof critical === 'string' ? critical : (critical.name ?? JSON.stringify(critical))}`,
      );
  }

  // ESG 회복 가능성
  if (esgSentiment?.regulatoryRisk !== undefined || esgSentiment?.overallScore !== undefined) {
    lines.push(`\n### ESG 회복 가능성 (esg-sentiment)`);
    if (esgSentiment.overallScore !== undefined)
      lines.push(`- ESG 종합 점수: ${esgSentiment.overallScore}`);
    if (esgSentiment.regulatoryRisk !== undefined)
      lines.push(`- 규제 리스크: ${esgSentiment.regulatoryRisk}`);
  }

  // 확산 리스크
  if (crisisScenario?.scenarios?.length) {
    lines.push(`\n### 위기 확산 리스크 (crisis-scenario)`);
    const spread =
      crisisScenario.scenarios.find((s: any) => s.type === 'spread') ?? crisisScenario.scenarios[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (spread)
      lines.push(`- 확산 시나리오: ${spread.title ?? spread.type} — ${spread.probability ?? ''}%`);
  }

  // 회복 장애 조건
  if (riskMap?.topRisks?.length) {
    lines.push(`\n### 회복 장애 조건 (risk-map)`);
    riskMap.topRisks.slice(0, 3).forEach((r: any) => {
      lines.push(`- ${r.title}: ${r.description?.slice(0, 80) ?? ''}`);
    });
  }

  return lines.length > 0
    ? lines.join('\n')
    : '선행 분석 데이터 없음 — 기사/댓글 데이터 기반으로 분석';
}
