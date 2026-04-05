import { subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export type OptimizationPreset = 'none' | 'light' | 'standard' | 'aggressive';

export const OPTIMIZATION_PRESETS: Record<
  OptimizationPreset,
  { label: string; description: string; estimatedReduction: string }
> = {
  none: {
    label: '없음',
    description: '전처리 없이 전체 데이터를 분석합니다.',
    estimatedReduction: '0%',
  },
  light: {
    label: '경량',
    description: '거의 동일한 중복 기사를 제거합니다.',
    estimatedReduction: '~30%',
  },
  standard: {
    label: '표준',
    description: '유사 기사 중복 제거 + 분석용 댓글 상위 100건으로 압축합니다.',
    estimatedReduction: '~60%',
  },
  aggressive: {
    label: '강력',
    description: '클러스터링으로 대표 기사만 분석, 댓글 상위 50건으로 압축합니다.',
    estimatedReduction: '~80%',
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
