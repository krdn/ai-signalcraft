// packages/core/src/db/seed-presets.ts
import { resolve } from 'path';
import { config } from 'dotenv';
import { findMonorepoRoot } from '../queue/worker-config';
import { getDb } from '../db';
import { analysisPresets } from './schema/presets';

// dotenv 로드 — apps/web/.env.local → .env 순서 (getDb() 호출 전 env 설정)
const root = findMonorepoRoot(process.cwd());
config({ path: resolve(root, 'apps/web/.env.local'), override: true });
config({ path: resolve(root, '.env') });

const PRESET_SEEDS = [
  // 핵심 활용
  {
    slug: 'politics',
    category: '핵심 활용',
    title: '정치 캠프',
    description:
      '실시간 여론 추적, 지지율 추정, 프레임 전쟁 분석으로 선거 전략을 데이터 기반으로 수립합니다.',
    icon: 'Target',
    highlight: '의사결정 시간 수일 → 수시간',
    sortOrder: 0,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 50, communityPosts: 100, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: false,
  },
  {
    slug: 'pr_crisis',
    category: '핵심 활용',
    domain: 'pr',
    title: 'PR / 위기관리',
    description:
      '위기 시나리오 3개와 대응 전략을 자동 생성합니다. 골든타임 안에 전략적 판단이 가능합니다.',
    icon: 'Shield',
    highlight: '수동 클리핑 주 20시간 → 0',
    sortOrder: 1,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: false,
  },
  {
    slug: 'corporate_reputation',
    category: '핵심 활용',
    title: '기업 평판 관리',
    description: '네이버·유튜브·커뮤니티 전체를 통합 분석하여 경영진 보고서를 자동 생성합니다.',
    icon: 'LineChart',
    highlight: '보고서 작성 3일 → 자동 생성',
    sortOrder: 2,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 50, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: false,
  },
  {
    slug: 'entertainment',
    category: '핵심 활용',
    domain: 'fandom',
    title: '연예인 / 기획사',
    description: '아티스트·배우의 온라인 반응을 실시간 추적하고, 팬덤 동향과 리스크를 분석합니다.',
    icon: 'Sparkles',
    highlight: '팬덤 여론 분석 자동화',
    sortOrder: 3,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 300, youtubeVideos: 100, communityPosts: 100, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: true,
  },
  // 산업 특화
  {
    slug: 'policy_research',
    category: '산업 특화',
    title: '정책 연구 / 싱크탱크',
    description:
      '특정 정책에 대한 국민 여론 구조를 파악하고, 정책 보고서의 실증 근거로 활용합니다.',
    icon: 'Landmark',
    highlight: '정책 수용도 분석 자동화',
    sortOrder: 4,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation', 'crisisScenario'],
    enableItemAnalysis: false,
  },
  {
    slug: 'finance',
    category: '산업 특화',
    title: '금융 / 투자 리서치',
    description:
      '기업·산업·경제 정책에 대한 시장 심리를 분석합니다. 뉴스 댓글과 커뮤니티 반응에서 선행 지표를 포착합니다.',
    icon: 'TrendingUp',
    highlight: '시장 심리 선행 지표 포착',
    sortOrder: 5,
    sources: { naver: true, youtube: false, dcinside: false, fmkorea: false, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 1000, youtubeVideos: 10, communityPosts: 30, commentsPerItem: 200 },
    optimization: 'light' as const,
    skippedModules: ['frameWar', 'winSimulation', 'crisisScenario', 'approvalRating'],
    enableItemAnalysis: false,
  },
  {
    slug: 'pharma_healthcare',
    category: '산업 특화',
    title: '제약 / 헬스케어',
    description: '신약 출시, 의료 이슈, 건강보험 정책 등에 대한 여론을 추적합니다.',
    icon: 'Bookmark',
    highlight: '의료 이슈 리스크 조기 감지',
    sortOrder: 6,
    sources: { naver: true, youtube: true, dcinside: false, fmkorea: false, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 30, commentsPerItem: 200 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: false,
  },
  {
    slug: 'public_sector',
    category: '산업 특화',
    title: '지자체 / 공공기관',
    description:
      '재개발, 교통, 환경 등 지역 현안에 대한 주민 여론을 사전에 파악하여 정책 소통에 활용합니다.',
    icon: 'Building2',
    highlight: '주민 여론 → 정책 소통 전략',
    sortOrder: 7,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['frameWar', 'winSimulation'],
    enableItemAnalysis: false,
  },
  // 확장 영역
  {
    slug: 'education',
    category: '확장 영역',
    title: '대학 / 교육기관',
    description: '입시 정책 변경, 대학 평판, 교육 이슈에 대한 학부모·학생 여론을 추적합니다.',
    icon: 'GraduationCap',
    highlight: '교육 정책 여론 즉시 파악',
    sortOrder: 8,
    sources: { naver: true, youtube: true, dcinside: false, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 300, youtubeVideos: 30, communityPosts: 50, commentsPerItem: 200 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: false,
  },
  {
    slug: 'sports',
    category: '확장 영역',
    domain: 'sports',
    title: '스포츠 / e스포츠',
    description: '선수 이적, 팀 성적에 따른 팬 반응을 실시간 추적합니다.',
    icon: 'Dumbbell',
    highlight: '팬 반응 실시간 추적',
    sortOrder: 9,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: false },
    customSourceIds: [],
    limits: { naverArticles: 300, youtubeVideos: 50, communityPosts: 100, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: [],
    enableItemAnalysis: true,
  },
  {
    slug: 'legal',
    category: '확장 영역',
    title: '법률 / 로펌',
    description: '소송 관련 여론전, 기업 분쟁 시 여론 동향을 파악하여 법적 전략 수립을 지원합니다.',
    icon: 'Briefcase',
    highlight: '여론재판 리스크 모니터링',
    sortOrder: 10,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 20, communityPosts: 50, commentsPerItem: 300 },
    optimization: 'standard' as const,
    skippedModules: ['approvalRating'],
    enableItemAnalysis: false,
  },
  {
    slug: 'franchise_retail',
    category: '확장 영역',
    title: '프랜차이즈 / 유통',
    description:
      '가맹점 이슈, 소비자 불매운동, 제품 리콜 등 브랜드 위기를 조기 감지하고 대응합니다.',
    icon: 'ExternalLink',
    highlight: '불매운동 조기 감지 → 대응',
    sortOrder: 11,
    sources: { naver: true, youtube: true, dcinside: true, fmkorea: true, clien: true },
    customSourceIds: [],
    limits: { naverArticles: 500, youtubeVideos: 30, communityPosts: 100, commentsPerItem: 500 },
    optimization: 'standard' as const,
    skippedModules: ['winSimulation', 'approvalRating'],
    enableItemAnalysis: false,
  },
];

export async function seedPresets() {
  const db = getDb();

  for (const seed of PRESET_SEEDS) {
    await db
      .insert(analysisPresets)
      .values(seed)
      .onConflictDoNothing({ target: analysisPresets.slug });
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] ${PRESET_SEEDS.length}개 분석 프리셋 시드 완료`);
}

// 직접 실행 시
seedPresets()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
