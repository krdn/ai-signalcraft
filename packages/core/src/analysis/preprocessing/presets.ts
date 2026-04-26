export type OptimizationPreset =
  | 'none'
  | 'light'
  | 'standard'
  | 'aggressive'
  | 'rag-light'
  | 'rag-standard'
  | 'rag-aggressive';

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
  // RAG 모드 — DB에 저장된 pgvector 임베딩을 활용한 의미 기반 선별
  // 기존 모드가 "매번 임베딩 재계산"인 반면, RAG는 DB 임베딩을 직접 활용
  'rag-light': {
    deduplication: false, // RAG가 유사도로 필터링하므로 별도 중복 제거 불필요
    similarityThreshold: null,
    clustering: false,
    commentLimit: null,
    label: 'RAG 경량',
    description: 'collector 임베딩으로 의미 관련 댓글 상위 200건 선별. 기사는 전체 유지.',
    estimatedReduction: '~40%',
    color: 'cyan',
  },
  'rag-standard': {
    deduplication: false,
    similarityThreshold: null,
    clustering: false,
    commentLimit: null,
    label: 'RAG 표준',
    description:
      'collector 임베딩으로 의미 관련 기사 130(=100+대표 30), 댓글 200건을 선별 후 시계열 균등 후샘플.',
    estimatedReduction: '~65%',
    color: 'blue',
  },
  'rag-aggressive': {
    deduplication: false,
    similarityThreshold: null,
    clustering: false,
    commentLimit: null,
    label: 'RAG 강력',
    description:
      'collector 임베딩으로 의미 관련 기사 65(=50+대표 15), 댓글 100건 선별 후 시계열 균등 후샘플.',
    estimatedReduction: '~80%',
    color: 'violet',
  },
};
