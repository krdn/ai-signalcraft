// 파이프라인 단계 브레이크포인트 — 사전 선택 시 해당 단계 완료 후 자동 정지
export const BREAKPOINT_STAGES = [
  'collection',
  'normalize',
  'token-optimization',
  'item-analysis',
  'analysis-stage1',
  'analysis-stage2',
  'analysis-stage4',
] as const;

export type BreakpointStage = (typeof BREAKPOINT_STAGES)[number];

export const BREAKPOINT_STAGE_LABELS: Record<BreakpointStage, string> = {
  collection: '수집 완료 후',
  normalize: '정규화 완료 후',
  'token-optimization': '토큰 최적화 완료 후',
  'item-analysis': '개별 감정 분석 완료 후',
  'analysis-stage1': 'AI 분석 Stage 1 완료 후 (병렬 4모듈)',
  'analysis-stage2': 'AI 분석 Stage 2 완료 후 (전략·최종요약)',
  'analysis-stage4': 'AI 분석 Stage 4 완료 후 (고급 분석)',
};

export type ResumeMode = 'continue' | 'step-once';
