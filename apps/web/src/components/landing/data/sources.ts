import {
  AtSign,
  BookOpen,
  Bookmark,
  Briefcase,
  Camera,
  CircleDot,
  Coffee,
  Compass,
  Eye,
  Feather,
  FileText,
  Flag,
  Globe,
  Hash,
  Headphones,
  Layers,
  MessageSquareWarning,
  TrendingUp,
  Users,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ActiveSource {
  name: string;
  icon: LucideIcon;
  url: string;
  help: string;
  method: string;
  collects: string[];
  strength: string;
  limit: string;
}

export const ACTIVE_SOURCES: ActiveSource[] = [
  {
    name: '네이버 뉴스',
    icon: Globe,
    url: 'https://news.naver.com',
    help: '국내 최대 뉴스 플랫폼에서 기사 본문을 자동 수집합니다. 40~60대 주 사용층의 여론을 대표하며, 보수 편향 보정을 적용합니다.',
    method: 'Fetch + Playwright 하이브리드',
    collects: [
      '기사 제목, 본문, 저자, 언론사',
      '발행일시, 조회수, 댓글 수',
      '날짜별 균등 분할 수집으로 최신순 편중 방지',
    ],
    strength: '중장년층 여론의 핵심 지표 · 보수 편향 자동 보정',
    limit: '기본 500건, 최대 1,000건',
  },
  {
    name: '네이버 댓글',
    icon: MessageSquareWarning,
    url: 'https://news.naver.com',
    help: '뉴스 기사별 댓글을 좋아요 순으로 수집합니다. 좋아요 수 기반 가중치로 실제 여론 대표성을 측정하며, 베스트댓글 편향을 보정합니다.',
    method: '네이버 댓글 API (좋아요순 정렬)',
    collects: [
      '댓글 내용, 작성자(마스킹), 좋아요/비추천 수',
      '대댓글 계층 구조 (토론 분석용)',
      '작성·수정 일시',
    ],
    strength: '좋아요 가중 키워드 추출 · 다수파 의견 분석',
    limit: '기사당 최대 500건',
  },
  {
    name: '유튜브',
    icon: BarChart3,
    url: 'https://www.youtube.com',
    help: '유튜브 영상 메타데이터와 댓글을 수집합니다. 전 연령대를 포괄하지만 채널별 정치 편향이 극심하여, 채널 성향별 가중치를 차등 적용합니다.',
    method: 'YouTube Data API v3 (공식 API)',
    collects: [
      '영상 제목, 설명, 채널명, 조회수, 좋아요 수',
      '영상별 댓글 (관련성순, 최대 500건)',
      '대댓글 계층 구조',
    ],
    strength: '전 연령대 포괄 · 채널별 편향 보정 · 확산력 측정',
    limit: '영상 50건, 댓글 영상당 500건',
  },
  {
    name: 'DC갤러리',
    icon: Users,
    url: 'https://www.dcinside.com',
    help: '국내 최대 익명 커뮤니티에서 게시글과 댓글을 수집합니다. 20~30대 MZ세대 여론을 대표하며, 풍자·비꼼 표현의 감정 극성을 역전 보정합니다.',
    method: 'Playwright 브라우저 자동화',
    collects: [
      '게시글 제목, 본문, 작성자, 갤러리명',
      '조회수, 추천 수, 댓글(대댓글 포함)',
      '마이너 갤러리 자동 감지',
    ],
    strength: 'MZ세대 핵심 여론 · 밈 확산 경로 추적 · 풍자 극성 역전',
    limit: '게시글 50건, 댓글 게시글당 100건',
  },
  {
    name: 'FM코리아',
    icon: TrendingUp,
    url: 'https://www.fmkorea.com',
    help: '유머·스포츠에서 정치까지 넓은 스펙트럼의 커뮤니티입니다. 유머 게시판 이슈가 정치화되는 속도를 추적하여 여론 확산 조기 경보에 활용합니다.',
    method: 'Playwright (WASM 안티봇 자동 통과)',
    collects: [
      '게시글 제목, 본문, 작성자, 게시판명',
      '조회수, 추천 수, 댓글(대댓글 포함)',
      'WASM 보안 챌린지 자동 처리',
    ],
    strength: '유머→정치 전환 추적 · 이슈 확산 조기 경보',
    limit: '게시글 50건, 댓글 게시글당 100건',
  },
  {
    name: '클리앙',
    icon: Layers,
    url: 'https://www.clien.net',
    help: '30~40대 IT 전문직 중심 커뮤니티입니다. 진보 편향이 강하며, 논리적 근거 기반의 심층 토론이 특징입니다. 감정 보정 시 긍정 비율을 하향 조정합니다.',
    method: 'Playwright 브라우저 자동화',
    collects: [
      '게시글 제목, 본문, 작성자, 게시판명',
      '조회수, 추천 수, 댓글(대댓글 포함)',
      '403 보호 자동 대응',
    ],
    strength: 'IT 전문직 심층 여론 · 논리 기반 비판 분석 · 진보 편향 보정',
    limit: '게시글 50건, 댓글 게시글당 100건',
  },
];

export interface UpcomingSource {
  name: string;
  icon: LucideIcon;
  url: string;
  help: string;
  goal: string;
}

export const UPCOMING_SOURCE_GROUPS: {
  label: string;
  sources: UpcomingSource[];
}[] = [
  {
    label: '국내 SNS · 뉴스',
    sources: [
      {
        name: 'X (트위터)',
        icon: AtSign,
        url: 'https://x.com',
        help: '실시간 속보와 정치적 발언이 가장 빠르게 공유되는 플랫폼입니다. 해시태그 트렌드와 리트윗 네트워크를 통해 여론 확산 속도를 측정합니다.',
        goal: '실시간 여론 확산 속도 측정, 인플루언서 영향력 분석',
      },
      {
        name: '인스타그램',
        icon: Camera,
        url: 'https://www.instagram.com',
        help: '20~30대 여성 사용자가 많은 시각 중심 플랫폼입니다. 릴스·스토리의 정치적 밈 확산과 감성적 반응 패턴을 분석합니다.',
        goal: 'MZ세대 여성층 감성 여론 분석, 시각적 밈 확산 추적',
      },
      {
        name: '다음 뉴스',
        icon: FileText,
        url: 'https://news.daum.net',
        help: '네이버와 양대 포털 뉴스로, 상대적으로 진보 편향 댓글이 많아 네이버와의 교차 검증에 활용합니다.',
        goal: '네이버 뉴스 대비 교차 검증, 포털 간 여론 격차 분석',
      },
      {
        name: '네이버 블로그',
        icon: BookOpen,
        url: 'https://blog.naver.com',
        help: '장문의 의견과 심층 분석이 공유되는 플랫폼입니다. 댓글보다 깊이 있는 여론 흐름과 개인의 정교한 논리를 파악합니다.',
        goal: '심층 여론 분석, 오피니언 리더 논리 구조 파악',
      },
    ],
  },
  {
    label: '국내 커뮤니티',
    sources: [
      {
        name: '네이버 카페',
        icon: Coffee,
        url: 'https://cafe.naver.com',
        help: '주제별 폐쇄형 커뮤니티로, 특정 관심사 집단의 깊이 있는 토론을 수집합니다. 맘카페, 부동산 카페 등 세그먼트별 여론 파악에 유리합니다.',
        goal: '관심사별 세그먼트 여론 분석, 폐쇄형 커뮤니티 심층 의견 수집',
      },
      {
        name: '더쿠',
        icon: Feather,
        url: 'https://theqoo.net',
        help: '20~30대 여성 중심 커뮤니티로, 연예·사회 이슈에 민감하게 반응합니다. DC갤러리와 성별 기반 교차 비교에 활용합니다.',
        goal: '여성층 여론 분석, DC갤러리 대비 성별 교차 검증',
      },
      {
        name: '뽐뿌',
        icon: Compass,
        url: 'https://www.ppomppu.co.kr',
        help: '소비·경제 중심 커뮤니티로, 물가·생활 경제 이슈에 대한 실생활 체감 여론을 수집합니다.',
        goal: '생활 경제 체감 여론 수집, 소비자 관점 이슈 분석',
      },
    ],
  },
  {
    label: '해외 플랫폼',
    sources: [
      {
        name: 'Reddit',
        icon: CircleDot,
        url: 'https://www.reddit.com',
        help: '한국 관련 서브레딧(r/korea 등)에서 해외 시각의 한국 정치·사회 여론을 수집합니다.',
        goal: '해외 시각 한국 여론 분석, 글로벌 프레임 비교',
      },
      {
        name: 'Google News',
        icon: Globe,
        url: 'https://news.google.com',
        help: '글로벌 뉴스 어그리게이터에서 한국 관련 해외 보도를 수집하여 국제 미디어 프레임을 분석합니다.',
        goal: '국제 미디어 프레임 분석, 해외 보도 논조 파악',
      },
      {
        name: 'TikTok',
        icon: Eye,
        url: 'https://www.tiktok.com',
        help: '10~20대 Z세대의 숏폼 콘텐츠에서 정치적 밈과 트렌드를 분석합니다. 알고리즘 기반 확산 패턴이 특징입니다.',
        goal: 'Z세대 여론 트렌드 파악, 숏폼 밈 확산 분석',
      },
      {
        name: 'LinkedIn',
        icon: Briefcase,
        url: 'https://www.linkedin.com',
        help: '비즈니스 전문가층의 경제·정책 관련 의견을 수집합니다. 전문적 관점의 심층 분석에 활용합니다.',
        goal: '비즈니스 전문가 여론 분석, 경제·정책 전문 의견 수집',
      },
      {
        name: 'Threads',
        icon: AtSign,
        url: 'https://www.threads.net',
        help: 'Meta 기반 텍스트 SNS로, 인스타그램 사용층과 연동된 여론을 수집합니다.',
        goal: 'Meta 생태계 여론 분석, 인스타그램 교차 분석',
      },
      {
        name: 'Facebook',
        icon: Users,
        url: 'https://www.facebook.com',
        help: '40~60대 사용자가 많은 SNS로, 중장년층의 공유·공감 패턴과 그룹 내 여론 형성을 분석합니다.',
        goal: '중장년층 SNS 여론 분석, 그룹 기반 여론 확산 추적',
      },
    ],
  },
  {
    label: '특수 소스',
    sources: [
      {
        name: '국민청원',
        icon: Flag,
        url: 'https://petitions.assembly.go.kr',
        help: '국회 국민동의청원 플랫폼에서 정치적 의제와 국민 관심사를 수집합니다. 동의 수로 이슈 크기를 정량화합니다.',
        goal: '정치적 의제 발굴, 국민 관심 이슈 정량 측정',
      },
      {
        name: 'Podcast',
        icon: Headphones,
        url: 'https://podcasts.apple.com',
        help: '정치·시사 팟캐스트의 에피소드 메타데이터와 리뷰를 수집하여 오피니언 리더의 프레임을 분석합니다.',
        goal: '오피니언 리더 프레임 분석, 팟캐스트 영향력 측정',
      },
      {
        name: '네이버 지식iN',
        icon: Hash,
        url: 'https://kin.naver.com',
        help: 'Q&A 형태의 일반인 질문·답변에서 대중의 궁금증과 관심 이슈를 파악합니다.',
        goal: '일반 대중 관심사 파악, 정보 수요 기반 이슈 발굴',
      },
      {
        name: '앱 리뷰',
        icon: Bookmark,
        url: 'https://play.google.com/store',
        help: '정치·뉴스 관련 앱의 사용자 리뷰에서 서비스 만족도와 정치적 성향 반응을 분석합니다.',
        goal: '뉴스·정치 앱 사용자 반응 분석, 미디어 신뢰도 파악',
      },
    ],
  },
];
