export type OptimizationPreset = 'none' | 'light' | 'standard' | 'aggressive';

export interface PresetConfig {
  deduplication: boolean;
  similarityThreshold: number | null;
  clustering: boolean;
  commentLimit: number | null;
  label: string;
  description: string;
  estimatedReduction: string;
  color: string;
}

export const OPTIMIZATION_PRESETS: Record<OptimizationPreset, PresetConfig> = {
  none: {
    deduplication: false,
    similarityThreshold: null,
    clustering: false,
    commentLimit: null,
    label: '없음',
    description: '전처리 없이 전체 데이터를 분석합니다.',
    estimatedReduction: '0%',
    color: 'zinc',
  },
  light: {
    deduplication: true,
    similarityThreshold: 0.95,
    clustering: false,
    commentLimit: 200,
    label: '경량',
    description: '거의 동일한 중복 기사를 제거합니다.',
    estimatedReduction: '~30%',
    color: 'green',
  },
  standard: {
    deduplication: true,
    similarityThreshold: 0.9,
    clustering: false,
    commentLimit: 100,
    label: '표준',
    description: '유사 기사 중복 제거 + 분석용 댓글 상위 100건으로 압축합니다.',
    estimatedReduction: '~60%',
    color: 'yellow',
  },
  aggressive: {
    deduplication: true,
    similarityThreshold: 0.85,
    clustering: true,
    commentLimit: 50,
    label: '강력',
    description: '클러스터링으로 대표 기사만 분석, 댓글 상위 50건으로 압축합니다.',
    estimatedReduction: '~80%',
    color: 'orange',
  },
};
