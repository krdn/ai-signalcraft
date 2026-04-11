import { subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export type OptimizationPreset =
  | 'none'
  | 'light'
  | 'standard'
  | 'aggressive'
  | 'rag-light'
  | 'rag-standard'
  | 'rag-aggressive';

// 프리셋별 스타일 매핑
export const PRESET_STYLES: Record<
  string,
  { border: string; bg: string; text: string; indicator: string }
> = {
  none: {
    border: 'border-zinc-500',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    indicator: 'bg-zinc-500/15 text-zinc-500',
  },
  light: {
    border: 'border-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    indicator: 'bg-green-500/15 text-green-500',
  },
  standard: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    indicator: 'bg-yellow-500/15 text-yellow-500',
  },
  aggressive: {
    border: 'border-orange-500',
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    indicator: 'bg-orange-500/15 text-orange-500',
  },
  'rag-light': {
    border: 'border-cyan-500',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-500',
    indicator: 'bg-cyan-500/15 text-cyan-500',
  },
  'rag-standard': {
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    indicator: 'bg-blue-500/15 text-blue-500',
  },
  'rag-aggressive': {
    border: 'border-violet-500',
    bg: 'bg-violet-500/10',
    text: 'text-violet-500',
    indicator: 'bg-violet-500/15 text-violet-500',
  },
};

export const OPTIMIZATION_PRESETS: Record<
  OptimizationPreset,
  { label: string; description: string; estimatedReduction: string; group: 'classic' | 'rag' }
> = {
  none: {
    label: '없음',
    description: '전처리 없이 전체 데이터를 분석합니다.',
    estimatedReduction: '0%',
    group: 'classic',
  },
  light: {
    label: '경량',
    description: '거의 동일한 중복 기사를 제거합니다.',
    estimatedReduction: '~30%',
    group: 'classic',
  },
  standard: {
    label: '표준',
    description: '유사 기사 중복 제거 + 분석용 댓글 상위 100건으로 압축합니다.',
    estimatedReduction: '~60%',
    group: 'classic',
  },
  aggressive: {
    label: '강력',
    description: '클러스터링으로 대표 기사만 분석, 댓글 상위 50건으로 압축합니다.',
    estimatedReduction: '~80%',
    group: 'classic',
  },
  'rag-light': {
    label: 'RAG 경량',
    description: 'DB 임베딩으로 의미 관련 댓글 상위 50건 선별. 기사는 전체 유지.',
    estimatedReduction: '~40%',
    group: 'rag',
  },
  'rag-standard': {
    label: 'RAG 표준',
    description: 'DB 임베딩으로 의미 관련 기사 30+클러스터 대표 10, 댓글 30건 선별.',
    estimatedReduction: '~65%',
    group: 'rag',
  },
  'rag-aggressive': {
    label: 'RAG 강력',
    description: 'DB 임베딩으로 의미 관련 기사 15+클러스터 대표 5, 댓글 15건 선별.',
    estimatedReduction: '~80%',
    group: 'rag',
  },
};

export const DATE_PRESETS = [
  { label: '최근 7일', getDates: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: '최근 14일', getDates: () => ({ start: subDays(new Date(), 14), end: new Date() }) },
  { label: '최근 30일', getDates: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  {
    label: '이번 주',
    getDates: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() }),
  },
  {
    label: '지난 주',
    getDates: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      };
    },
  },
] as const;

export type SourceId = 'naver' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien';

export const SOURCE_OPTIONS = [
  {
    group: '뉴스/영상',
    items: [
      { id: 'naver' as SourceId, label: '네이버 뉴스' },
      { id: 'youtube' as SourceId, label: '유튜브' },
    ],
  },
  {
    group: '커뮤니티',
    items: [
      { id: 'dcinside' as SourceId, label: 'DC갤러리' },
      { id: 'fmkorea' as SourceId, label: '에펨코리아' },
      { id: 'clien' as SourceId, label: '클리앙' },
    ],
  },
];

export const ALL_SOURCES: SourceId[] = ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'];
