'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Award,
  BarChart2,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  Brain,
  Briefcase,
  Building2,
  Camera,
  CheckSquare,
  ChevronRight,
  CircleDot,
  Clock,
  ClipboardList,
  Coffee,
  Coins,
  Compass,
  Crosshair,
  Crown,
  DollarSign,
  Dumbbell,
  ExternalLink,
  Eye,
  Feather,
  FileBarChart,
  FileText,
  Flag,
  Flame,
  Gauge,
  Globe,
  GraduationCap,
  Hash,
  Headphones,
  Heart,
  HeartPulse,
  Landmark,
  Layers,
  Lightbulb,
  LineChart,
  ListChecks,
  Megaphone,
  MessageCircle,
  MessageSquareWarning,
  Network,
  PieChart,
  Radar,
  Rocket,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Signal,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Users2,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ACTIVE_SOURCES = [
  { name: '네이버 뉴스', icon: Globe, url: 'https://news.naver.com' },
  { name: '네이버 댓글', icon: MessageSquareWarning, url: 'https://news.naver.com' },
  { name: '유튜브', icon: BarChart3, url: 'https://www.youtube.com' },
  { name: 'DC갤러리', icon: Users, url: 'https://www.dcinside.com' },
  { name: 'FM코리아', icon: TrendingUp, url: 'https://www.fmkorea.com' },
  { name: '클리앙', icon: Layers, url: 'https://www.clien.net' },
];

const UPCOMING_SOURCE_GROUPS = [
  {
    label: '국내 SNS · 뉴스',
    sources: [
      { name: 'X (트위터)', icon: AtSign, url: 'https://x.com' },
      { name: '인스타그램', icon: Camera, url: 'https://www.instagram.com' },
      { name: '다음 뉴스', icon: FileText, url: 'https://news.daum.net' },
      { name: '네이버 블로그', icon: BookOpen, url: 'https://blog.naver.com' },
    ],
  },
  {
    label: '국내 커뮤니티',
    sources: [
      { name: '네이버 카페', icon: Coffee, url: 'https://cafe.naver.com' },
      { name: '더쿠', icon: Feather, url: 'https://theqoo.net' },
      { name: '뽐뿌', icon: Compass, url: 'https://www.ppomppu.co.kr' },
    ],
  },
  {
    label: '해외 플랫폼',
    sources: [
      { name: 'Reddit', icon: CircleDot, url: 'https://www.reddit.com' },
      { name: 'Google News', icon: Globe, url: 'https://news.google.com' },
      { name: 'TikTok', icon: Eye, url: 'https://www.tiktok.com' },
      { name: 'LinkedIn', icon: Briefcase, url: 'https://www.linkedin.com' },
      { name: 'Threads', icon: AtSign, url: 'https://www.threads.net' },
      { name: 'Facebook', icon: Users, url: 'https://www.facebook.com' },
    ],
  },
  {
    label: '특수 소스',
    sources: [
      { name: '국민청원', icon: Flag, url: 'https://petitions.assembly.go.kr' },
      { name: 'Podcast', icon: Headphones, url: 'https://podcasts.apple.com' },
      { name: '네이버 지식iN', icon: Hash, url: 'https://kin.naver.com' },
      { name: '앱 리뷰', icon: Bookmark, url: 'https://play.google.com/store' },
    ],
  },
];

const MODULES = [
  {
    stage: 'Stage 1',
    label: '초기 분석',
    color: 'bg-blue-500/10 text-blue-600',
    items: ['거시 여론 구조', '집단별 반응', '감정/프레임 분석', '메시지 파급력'],
  },
  {
    stage: 'Stage 2',
    label: '심화 분석',
    color: 'bg-purple-500/10 text-purple-600',
    items: ['리스크 지도', '기회 분석', '전략 도출', '최종 요약'],
  },
  {
    stage: 'Stage 4',
    label: '고급 분석',
    color: 'bg-amber-500/10 text-amber-600',
    items: ['지지율 추정', '프레임 전쟁', '위기 시나리오', '승리 시뮬레이션'],
  },
];

const USE_CASE_CATEGORIES = [
  {
    label: '핵심 활용',
    cases: [
      {
        icon: Target,
        title: '정치 캠프',
        description:
          '실시간 여론 추적, 지지율 추정, 프레임 전쟁 분석으로 선거 전략을 데이터 기반으로 수립합니다.',
        highlight: '의사결정 시간 수일 → 수시간',
      },
      {
        icon: Shield,
        title: 'PR / 위기관리',
        description:
          '위기 시나리오 3개와 대응 전략을 자동 생성합니다. 골든타임 안에 전략적 판단이 가능합니다.',
        highlight: '수동 클리핑 주 20시간 → 0',
      },
      {
        icon: LineChart,
        title: '기업 평판 관리',
        description: '네이버·유튜브·커뮤니티 전체를 통합 분석하여 경영진 보고서를 자동 생성합니다.',
        highlight: '보고서 작성 3일 → 자동 생성',
      },
      {
        icon: Sparkles,
        title: '연예인 / 기획사',
        description:
          '아티스트·배우의 온라인 반응을 실시간 추적하고, 팬덤 동향과 리스크를 분석하여 매니지먼트 전략을 지원합니다.',
        highlight: '팬덤 여론 분석 자동화',
      },
    ],
  },
  {
    label: '산업 특화',
    cases: [
      {
        icon: Landmark,
        title: '정책 연구 / 싱크탱크',
        description:
          '특정 정책에 대한 국민 여론 구조를 파악하고, 정책 보고서의 실증 근거로 활용합니다.',
        highlight: '정책 수용도 분석 자동화',
      },
      {
        icon: TrendingUp,
        title: '금융 / 투자 리서치',
        description:
          '기업·산업·경제 정책에 대한 시장 심리를 분석합니다. 뉴스 댓글과 커뮤니티 반응에서 선행 지표를 포착합니다.',
        highlight: '시장 심리 선행 지표 포착',
      },
      {
        icon: Bookmark,
        title: '제약 / 헬스케어',
        description:
          '신약 출시, 의료 이슈, 건강보험 정책 등에 대한 여론을 추적합니다. 약물 부작용 이슈를 조기에 감지합니다.',
        highlight: '의료 이슈 리스크 조기 감지',
      },
      {
        icon: Building2,
        title: '지자체 / 공공기관',
        description:
          '재개발, 교통, 환경 등 지역 현안에 대한 주민 여론을 사전에 파악하여 정책 소통에 활용합니다.',
        highlight: '주민 여론 → 정책 소통 전략',
      },
    ],
  },
  {
    label: '확장 영역',
    cases: [
      {
        icon: GraduationCap,
        title: '대학 / 교육기관',
        description:
          '입시 정책 변경, 대학 평판, 교육 이슈에 대한 학부모·학생 여론을 추적하고 대응 전략을 도출합니다.',
        highlight: '교육 정책 여론 즉시 파악',
      },
      {
        icon: Dumbbell,
        title: '스포츠 / e스포츠',
        description:
          '선수 이적, 팀 성적에 따른 팬 반응을 실시간 추적합니다. 팬덤 관리와 스폰서 리포팅에 활용합니다.',
        highlight: '팬 반응 실시간 추적',
      },
      {
        icon: Briefcase,
        title: '법률 / 로펌',
        description:
          '소송 관련 여론전, 기업 분쟁 시 여론 동향을 파악하여 법적 전략 수립을 지원합니다.',
        highlight: '여론재판 리스크 모니터링',
      },
      {
        icon: ExternalLink,
        title: '프랜차이즈 / 유통',
        description:
          '가맹점 이슈, 소비자 불매운동, 제품 리콜 등 브랜드 위기를 조기 감지하고 대응 전략을 생성합니다.',
        highlight: '불매운동 조기 감지 → 대응',
      },
    ],
  },
];

// 각 활용 분야별 상세 활용 가이드 (모달에 표시)
interface UseCaseDetail {
  title: string;
  tagline: string;
  icon: LucideIcon;
  color: string;
  painPoints: { icon: LucideIcon; text: string }[];
  scenarios: { title: string; description: string; icon: LucideIcon }[];
  recommendedSources: {
    active: string[];
    upcoming: string[];
    reason: string;
  };
  workflow: { step: string; detail: string }[];
  keyModules: string[];
  impactMetrics: { label: string; before: string; after: string; icon: LucideIcon }[];
  insightQuote: string;
}

const USE_CASE_DETAILS: Record<string, UseCaseDetail> = {
  '정치 캠프': {
    title: '정치 캠프',
    tagline: '데이터로 선거를 설계하다',
    icon: Target,
    color: 'text-red-500',
    painPoints: [
      { icon: Timer, text: '여론 변화 감지에 2~3일 지연, 골든타임 놓침' },
      { icon: Users2, text: '보좌관 개인 감각에 의존한 전략 수립' },
      { icon: AlertTriangle, text: '상대 캠프 공격 프레임에 대한 실시간 대응 불가' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', '유튜브', 'DC갤러리', 'FM코리아', '클리앙'],
      upcoming: ['X (트위터)', '다음 뉴스', '국민청원', 'Reddit'],
      reason:
        '정치 여론은 뉴스 댓글과 커뮤니티에서 가장 활발하게 형성됩니다. DC갤러리·FM코리아는 정치 토론의 핵심 공간이며, 유튜브 정치 채널 댓글도 주요 여론 지표입니다.',
    },
    scenarios: [
      {
        title: '실시간 여론 전쟁 대시보드',
        description:
          '후보 A vs B의 온라인 언급량, 감정 비율, 프레임 점유율을 실시간으로 비교합니다. 상대 후보의 네거티브 공격이 확산되는 순간 즉시 알림을 받고, AI가 제안하는 3가지 대응 시나리오 중 최적안을 선택합니다.',
        icon: Radar,
      },
      {
        title: '지지층 균열 조기 감지',
        description:
          '커뮤니티별 감정 변화 추이를 분석하여 핵심 지지층의 이탈 징후를 72시간 전에 포착합니다. "경제 정책 실망", "공약 후퇴" 등 이탈 원인 키워드를 자동 추출하고 맞춤 메시지 전략을 생성합니다.',
        icon: ShieldAlert,
      },
      {
        title: '프레임 전쟁 시뮬레이션',
        description:
          '특정 이슈에 대해 가능한 프레임(예: "안보 vs 평화", "성장 vs 분배")의 여론 침투력을 시뮬레이션합니다. 어떤 프레임이 중간층을 움직이는지 데이터로 검증한 후 캠페인에 반영합니다.',
        icon: Crosshair,
      },
    ],
    workflow: [
      { step: '후보명 + 상대 후보명 입력', detail: '비교 분석 모드 자동 활성화' },
      { step: '6개 소스에서 관련 여론 수집', detail: '뉴스·댓글·커뮤니티·유튜브 종합' },
      { step: 'AI가 프레임·감정·리스크 분석', detail: '14개 모듈 순차 실행' },
      { step: '전략 리포트 + 대응 시나리오 생성', detail: '즉시 실행 가능한 액션 플랜' },
    ],
    keyModules: ['프레임 전쟁 분석', '지지율 추정', '위기 시나리오', '승리 시뮬레이션'],
    impactMetrics: [
      { label: '여론 감지 속도', before: '2~3일', after: '실시간', icon: Gauge },
      { label: '전략 수립 시간', before: '주 단위', after: '수시간', icon: Timer },
      { label: '프레임 대응', before: '사후 대응', after: '선제 대응', icon: ShieldCheck },
    ],
    insightQuote:
      '선거는 여론의 흐름을 먼저 읽는 쪽이 이깁니다. AI SignalCraft는 그 흐름을 데이터로 보여줍니다.',
  },
  'PR / 위기관리': {
    title: 'PR / 위기관리',
    tagline: '위기의 골든타임, AI가 지킵니다',
    icon: Shield,
    color: 'text-orange-500',
    painPoints: [
      { icon: Flame, text: '위기 발생 후 대응 전략 수립까지 24시간 이상 소요' },
      { icon: ClipboardList, text: '수동 클리핑에 주 20시간, 핵심 이슈 누락 빈번' },
      { icon: AlertTriangle, text: '경영진 보고서 작성에 추가 2~3일 소요' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', '유튜브', 'DC갤러리', 'FM코리아'],
      upcoming: ['X (트위터)', '인스타그램', '네이버 블로그', '다음 뉴스', 'Facebook'],
      reason:
        '위기 확산은 뉴스 → 댓글 → 커뮤니티 → SNS 순으로 진행됩니다. 네이버 뉴스와 댓글에서 초기 감지하고, 커뮤니티 확산 속도를 추적하는 것이 핵심입니다.',
    },
    scenarios: [
      {
        title: '위기 조기경보 시스템',
        description:
          '부정 여론 급증, 특정 키워드 폭발("불매", "사과", "고발") 패턴을 감지하면 즉시 알림을 발송합니다. AI가 위기 심각도를 5단계로 평가하고, 단계별 대응 매뉴얼을 자동 생성합니다.',
        icon: Bell,
      },
      {
        title: '3가지 위기 시나리오 자동 생성',
        description:
          '현재 여론 데이터를 기반으로 최선·기본·최악 시나리오를 각각 시뮬레이션합니다. 각 시나리오별 대응 메시지, 타이밍, 채널 전략까지 구체적인 액션 플랜을 제시합니다.',
        icon: Activity,
      },
      {
        title: '경쟁사 리스크 모니터링',
        description:
          '경쟁사의 위기가 우리에게 기회인지, 연쇄 리스크인지를 분석합니다. 같은 산업 내 이슈가 확산될 때 선제적 포지셔닝 전략을 AI가 도출합니다.',
        icon: Eye,
      },
    ],
    workflow: [
      { step: '브랜드명 + 위기 키워드 입력', detail: '위기관리 모드 자동 활성화' },
      { step: '실시간 여론 수집 + 감정 급변 감지', detail: '부정 여론 스파이크 포착' },
      { step: 'AI가 위기 등급·원인·확산 경로 분석', detail: '리스크 맵 자동 생성' },
      { step: '3가지 시나리오 + 대응 전략 리포트', detail: '경영진 보고용 PDF 즉시 생성' },
    ],
    keyModules: ['리스크 지도', '위기 시나리오', '감정/프레임 분석', '최종 요약'],
    impactMetrics: [
      { label: '위기 감지', before: '언론 보도 후', after: '온라인 확산 초기', icon: Bell },
      { label: '대응 전략 수립', before: '24시간+', after: '2시간 이내', icon: Timer },
      { label: '클리핑 작업', before: '주 20시간', after: '완전 자동화', icon: CheckSquare },
    ],
    insightQuote:
      '위기관리의 80%는 감지 속도입니다. 골든타임 안에 데이터 기반 의사결정을 내리세요.',
  },
  '기업 평판 관리': {
    title: '기업 평판 관리',
    tagline: '기업의 온라인 평판을 360도로 관리합니다',
    icon: LineChart,
    color: 'text-blue-500',
    painPoints: [
      { icon: PieChart, text: '채널별 여론을 통합해서 보는 뷰가 없음' },
      { icon: FileBarChart, text: '경영진 리포트 작성에 전담 인력 필요' },
      { icon: Signal, text: '평판 변화의 원인 파악이 주관적 판단에 의존' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', '유튜브', 'DC갤러리', 'FM코리아', '클리앙'],
      upcoming: ['네이버 블로그', '네이버 카페', 'LinkedIn', 'Google News', '앱 리뷰'],
      reason:
        '기업 평판은 뉴스 보도와 커뮤니티 반응의 교차 분석이 중요합니다. 클리앙·FM코리아의 소비자 반응과 네이버 뉴스 댓글의 일반 여론을 통합해야 전체 그림이 보입니다.',
    },
    scenarios: [
      {
        title: '통합 평판 대시보드',
        description:
          '뉴스·댓글·유튜브·커뮤니티를 하나의 대시보드에서 통합 모니터링합니다. 채널별 감정 비율, 핵심 키워드 변화, 인플루언서 반응을 한눈에 파악하고 주간/월간 트렌드를 자동 추적합니다.',
        icon: BarChart2,
      },
      {
        title: '경영진 자동 리포트',
        description:
          '주간/월간 단위로 경영진용 종합 리포트를 자동 생성합니다. "이번 주 핵심 이슈 3가지", "평판 리스크 등급 변화", "경쟁사 대비 포지션" 등 C-Level이 바로 의사결정에 활용할 수 있는 형태로 제공합니다.',
        icon: Crown,
      },
      {
        title: 'ESG·CSR 여론 트래킹',
        description:
          '기업의 ESG 활동, 사회공헌, 환경 이슈에 대한 여론을 별도 트래킹합니다. 긍정 여론 확산에 성공한 캠페인과 백래시를 받은 캠페인의 차이를 분석하여 다음 CSR 전략에 반영합니다.',
        icon: Heart,
      },
    ],
    workflow: [
      { step: '기업명 + 경쟁사 입력', detail: '비교 분석 모드로 수집 시작' },
      { step: '6개 채널 통합 여론 수집', detail: '뉴스·댓글·커뮤니티·유튜브 병렬 수집' },
      { step: 'AI가 평판 점수·리스크·기회 분석', detail: '14개 모듈 종합 분석' },
      { step: '경영진 리포트 자동 생성', detail: 'PDF 다운로드 + 대시보드 업데이트' },
    ],
    keyModules: ['거시 여론 구조', '집단별 반응', '리스크 지도', '기회 분석'],
    impactMetrics: [
      { label: '리포트 작성', before: '3일', after: '자동 생성', icon: FileBarChart },
      { label: '채널 커버리지', before: '뉴스 위주', after: '6개 소스 통합', icon: Network },
      { label: '인사이트 품질', before: '주관적 판단', after: 'AI 데이터 기반', icon: Brain },
    ],
    insightQuote:
      '평판은 쌓는 데 10년, 무너지는 데 10초입니다. 데이터로 평판의 미세한 변화를 포착하세요.',
  },
  '연예인 / 기획사': {
    title: '연예인 / 기획사',
    tagline: '팬심을 데이터로, 리스크를 기회로',
    icon: Sparkles,
    color: 'text-pink-500',
    painPoints: [
      { icon: Flame, text: 'SNS 악플·루머 확산 감지가 늦어 대응 실패' },
      { icon: Users2, text: '팬덤 감정 변화를 정량적으로 파악할 수 없음' },
      { icon: Activity, text: '컴백·활동 시 여론 반응 예측이 감에 의존' },
    ],
    recommendedSources: {
      active: ['유튜브', '네이버 뉴스', '네이버 댓글', 'DC갤러리'],
      upcoming: ['X (트위터)', '인스타그램', '더쿠', 'TikTok', 'Threads'],
      reason:
        '팬덤 여론은 더쿠·DC갤러리 등 커뮤니티에서 형성되고 유튜브·X·인스타그램으로 확산됩니다. 유튜브 음원/무대 영상 댓글은 팬 반응의 핵심 지표입니다.',
    },
    scenarios: [
      {
        title: '팬덤 감정 실시간 모니터링',
        description:
          '아티스트 관련 커뮤니티·유튜브·뉴스 댓글의 감정 변화를 실시간 추적합니다. 팬덤 내 불만 키워드("실망", "탈덕", "사과해")가 임계치를 넘으면 즉시 알림을 발송하고, AI가 원인 분석과 대응 방향을 제시합니다.',
        icon: Heart,
      },
      {
        title: '컴백·활동 여론 예측',
        description:
          '신곡 발매, 드라마 출연, 예능 출연 등 활동 전후의 여론 변화를 분석합니다. 과거 데이터 기반으로 반응을 예측하고, 긍정 여론 극대화를 위한 프로모션 타이밍과 채널 전략을 추천합니다.',
        icon: Star,
      },
      {
        title: '논란 이슈 자동 위기 대응',
        description:
          '열애설, 학폭, 사생활 논란 등 이슈 발생 시 AI가 여론의 방향성(일시적 호기심 vs 심각한 이탈)을 판단합니다. "침묵 전략", "즉시 해명", "제3자 증언" 등 상황별 최적 대응안을 제시합니다.',
        icon: ShieldAlert,
      },
    ],
    workflow: [
      { step: '아티스트명 입력', detail: '팬덤 모니터링 모드 활성화' },
      { step: '커뮤니티·유튜브·뉴스 실시간 수집', detail: '팬 반응 집중 수집' },
      { step: 'AI가 팬덤 감정·이슈·리스크 분석', detail: '감정 변화 곡선 생성' },
      { step: '매니지먼트 전략 리포트 생성', detail: '대응 시나리오 포함' },
    ],
    keyModules: ['감정/프레임 분석', '메시지 파급력', '위기 시나리오', '전략 도출'],
    impactMetrics: [
      { label: '악플 감지', before: '팬 제보 후', after: '확산 초기 자동 감지', icon: Bell },
      { label: '팬덤 분석', before: '정성적 판단', after: '정량적 데이터', icon: BarChart2 },
      { label: '위기 대응', before: '회의 후 결정', after: 'AI 시나리오 즉시', icon: Rocket },
    ],
    insightQuote:
      '팬덤은 가장 강력한 자산이자 가장 민감한 센서입니다. 데이터로 팬심의 온도를 읽으세요.',
  },
  '정책 연구 / 싱크탱크': {
    title: '정책 연구 / 싱크탱크',
    tagline: '국민 여론을 정책의 나침반으로',
    icon: Landmark,
    color: 'text-emerald-600',
    painPoints: [
      { icon: Search, text: '정책 수용도를 파악할 실증 데이터 부족' },
      { icon: ClipboardList, text: '여론조사는 비용·시간이 크고 실시간성이 없음' },
      { icon: PieChart, text: '온라인 여론의 구조적 분석 방법론 부재' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', 'DC갤러리', 'FM코리아', '클리앙'],
      upcoming: ['국민청원', '다음 뉴스', '네이버 카페', '네이버 블로그'],
      reason:
        '정책 여론은 뉴스 댓글에서 즉각적으로 드러나고, 커뮤니티에서 심층 토론됩니다. 국민청원은 정책 불만의 직접적 지표이며, 네이버 카페는 이해관계자 그룹의 조직적 반응을 파악하는 데 유용합니다.',
    },
    scenarios: [
      {
        title: '정책 수용도 실시간 측정',
        description:
          '새 정책 발표 직후 뉴스 댓글·커뮤니티·유튜브에서 국민 반응을 즉시 수집합니다. 지지·반대·관망 비율을 정량화하고, 반대 의견의 핵심 논거를 자동 추출하여 정책 보완 포인트를 도출합니다.',
        icon: PieChart,
      },
      {
        title: '집단별 반응 구조 분석',
        description:
          '연령·성별·정치 성향·지역별로 정책에 대한 반응이 어떻게 다른지 구조적으로 분석합니다. "MZ세대는 환경 정책에 긍정적이나 비용 부담을 우려"와 같은 세분화된 인사이트를 정책 보고서에 실증 근거로 활용합니다.',
        icon: Users2,
      },
      {
        title: '국제 비교 여론 분석',
        description:
          '같은 정책을 시행한 해외 사례에 대한 국내 여론과 해외 여론을 비교 분석합니다. 정책 도입 시 예상되는 여론 반응을 선제적으로 파악하고, 커뮤니케이션 전략을 사전에 수립합니다.',
        icon: Globe,
      },
    ],
    workflow: [
      { step: '정책 주제 + 키워드 입력', detail: '정책 분석 모드 활성화' },
      { step: '관련 여론 데이터 자동 수집', detail: '뉴스·댓글·커뮤니티 종합' },
      { step: 'AI가 수용도·집단별 반응·프레임 분석', detail: '실증 데이터 자동 생성' },
      { step: '정책 보고서용 인사이트 리포트', detail: '인용 가능한 형태로 제공' },
    ],
    keyModules: ['거시 여론 구조', '집단별 반응', '감정/프레임 분석', '기회 분석'],
    impactMetrics: [
      { label: '여론 파악 주기', before: '분기별 조사', after: '실시간 모니터링', icon: Gauge },
      { label: '분석 비용', before: '건당 수백만원', after: '월정액 구독', icon: Coins },
      { label: '보고서 근거', before: '정성적 해석', after: '정량적 데이터', icon: FileBarChart },
    ],
    insightQuote:
      '좋은 정책도 국민이 수용하지 않으면 실패합니다. 정책 설계 단계부터 여론 데이터를 반영하세요.',
  },
  '금융 / 투자 리서치': {
    title: '금융 / 투자 리서치',
    tagline: '시장 심리를 먼저 읽는 투자 엣지',
    icon: TrendingUp,
    color: 'text-green-600',
    painPoints: [
      { icon: Timer, text: '시장 심리 변화를 뉴스만으로 파악하면 이미 늦음' },
      { icon: Search, text: '커뮤니티·댓글에 숨어있는 선행 지표를 놓침' },
      { icon: Activity, text: '개인 투자자 심리를 정량적으로 측정할 도구 부재' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', 'DC갤러리', 'FM코리아', '클리앙'],
      upcoming: ['네이버 카페', 'Reddit', 'X (트위터)', 'Google News'],
      reason:
        'DC갤러리 주식 갤러리, FM코리아 주식 게시판은 개인 투자자 심리의 실시간 바로미터입니다. 네이버 뉴스 댓글의 경제 기사 반응은 시장 심리 선행 지표로 활용됩니다.',
    },
    scenarios: [
      {
        title: '시장 심리 선행 지표 포착',
        description:
          '주식·부동산·암호화폐 관련 커뮤니티와 뉴스 댓글에서 투자 심리의 변화를 수치화합니다. "공포 → 탐욕" 전환점, 특정 종목/섹터에 대한 관심 급증을 시장 가격 변동 전에 포착합니다.',
        icon: Signal,
      },
      {
        title: '기업 이벤트 여론 임팩트 분석',
        description:
          '실적 발표, CEO 교체, M&A, 신사업 진출 등 기업 이벤트에 대한 온라인 여론의 방향과 강도를 분석합니다. "시장이 이미 반영했는지" vs "아직 미반영된 정보인지"를 판단하는 보조 지표로 활용합니다.',
        icon: Activity,
      },
      {
        title: '정책 리스크 조기 감지',
        description:
          '금융 규제, 세제 변경, 산업 정책 발표에 대한 시장 참여자들의 실시간 반응을 추적합니다. 정책 발표 → 여론 형성 → 시장 반영의 타임라인을 분석하여 투자 타이밍 판단에 활용합니다.',
        icon: AlertTriangle,
      },
    ],
    workflow: [
      { step: '기업명/종목/정책 키워드 입력', detail: '금융 분석 모드 활성화' },
      { step: '투자 커뮤니티 + 뉴스 댓글 수집', detail: '투자 심리 데이터 집중 수집' },
      { step: 'AI가 심리 지표·리스크·기회 분석', detail: '시장 심리 점수 산출' },
      { step: '투자 리서치 보조 리포트 생성', detail: '선행 지표 + 시나리오 분석' },
    ],
    keyModules: ['감정/프레임 분석', '리스크 지도', '기회 분석', '메시지 파급력'],
    impactMetrics: [
      { label: '심리 감지', before: '뉴스 보도 후', after: '커뮤니티 선행 포착', icon: Radar },
      { label: '분석 범위', before: '뉴스 중심', after: '6개 소스 통합', icon: Network },
      { label: '리서치 시간', before: '종일 모니터링', after: 'AI 자동 분석', icon: Timer },
    ],
    insightQuote:
      '시장은 뉴스보다 댓글에서 먼저 움직입니다. 군중 심리의 미세한 변화를 데이터로 읽으세요.',
  },
  '제약 / 헬스케어': {
    title: '제약 / 헬스케어',
    tagline: '의료 여론의 맥박을 짚다',
    icon: Bookmark,
    color: 'text-teal-500',
    painPoints: [
      { icon: HeartPulse, text: '약물 부작용 여론이 SNS에서 먼저 확산됨' },
      { icon: Scale, text: '건강보험 정책 변화에 대한 환자·의료진 반응 파악 어려움' },
      { icon: Megaphone, text: '신약 출시 시 긍정/부정 여론 관리 도구 부재' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', '클리앙', 'FM코리아'],
      upcoming: ['네이버 카페', '네이버 블로그', '네이버 지식iN', '앱 리뷰'],
      reason:
        '환자 커뮤니티(네이버 카페)와 건강 관련 블로그에서 부작용 경험담이 공유됩니다. 네이버 지식iN의 의료 질문은 환자 니즈의 직접적 지표이며, 앱 리뷰는 디지털 헬스케어 반응을 파악하는 데 유용합니다.',
    },
    scenarios: [
      {
        title: '약물 부작용 이슈 조기 감지',
        description:
          '환자 커뮤니티, 건강 포럼, 뉴스 댓글에서 특정 약물의 부작용 언급이 증가하는 패턴을 감지합니다. "두통", "발진", "효과 없음" 등 부작용 키워드의 빈도 변화를 추적하여 안전성 이슈를 조기에 파악합니다.',
        icon: AlertTriangle,
      },
      {
        title: '신약 출시 여론 모니터링',
        description:
          '신약 허가·출시 전후로 환자·의료진·일반인의 기대와 우려를 분석합니다. 경쟁 약물 대비 포지셔닝, 가격 정책에 대한 여론, 처방 의향 변화를 추적하여 마케팅 전략을 최적화합니다.',
        icon: Rocket,
      },
      {
        title: '건강보험 정책 임팩트 분석',
        description:
          '급여 기준 변경, 본인부담금 조정 등 정책 변화에 대한 환자·의료기관의 반응을 실시간 분석합니다. 정책 시행 전 예상 반응을 시뮬레이션하여 정책 소통 전략을 사전에 수립합니다.',
        icon: Landmark,
      },
    ],
    workflow: [
      { step: '약물명/질환/정책 키워드 입력', detail: '헬스케어 분석 모드 활성화' },
      { step: '건강 커뮤니티 + 뉴스 수집', detail: '환자·의료진 여론 집중 수집' },
      { step: 'AI가 안전성 신호·여론·리스크 분석', detail: '부작용 키워드 자동 추출' },
      { step: '의료 이슈 리포트 생성', detail: '안전성 모니터링 + 여론 트렌드' },
    ],
    keyModules: ['리스크 지도', '집단별 반응', '감정/프레임 분석', '전략 도출'],
    impactMetrics: [
      { label: '부작용 감지', before: '공식 보고 후', after: '온라인 확산 초기', icon: Bell },
      { label: '여론 분석', before: '수동 모니터링', after: 'AI 자동 분석', icon: Brain },
      { label: '리포트 주기', before: '월간', after: '주간/실시간', icon: Gauge },
    ],
    insightQuote:
      '환자의 목소리는 임상시험보다 빠릅니다. 온라인 여론에서 안전성 신호를 먼저 읽으세요.',
  },
  '지자체 / 공공기관': {
    title: '지자체 / 공공기관',
    tagline: '주민과의 소통, 데이터로 시작합니다',
    icon: Building2,
    color: 'text-slate-600',
    painPoints: [
      { icon: MessageCircle, text: '민원 접수 후에야 주민 불만을 인지' },
      { icon: Megaphone, text: '정책 홍보 효과를 측정할 도구 부재' },
      { icon: Users2, text: '주민설명회만으로는 다양한 의견 수렴 어려움' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', 'DC갤러리', 'FM코리아'],
      upcoming: ['네이버 카페', '다음 뉴스', '국민청원', '네이버 블로그'],
      reason:
        '지역 현안은 지역 맘카페(네이버 카페)와 지역 커뮤니티에서 가장 활발하게 논의됩니다. 국민청원은 주민 불만의 강도를 측정하는 직접 지표이며, 지역 뉴스 댓글은 주민 정서의 바로미터입니다.',
    },
    scenarios: [
      {
        title: '지역 현안 여론 사전 파악',
        description:
          '재개발, 교통, 환경, 소음 등 지역 현안에 대한 주민 여론을 온라인에서 사전 수집합니다. 지역 커뮤니티·뉴스 댓글에서 불만이 확산되기 전에 포착하여 선제적 대응이 가능합니다.',
        icon: Search,
      },
      {
        title: '정책 소통 효과 측정',
        description:
          '정책 발표·홍보 캠페인 전후의 주민 반응을 정량적으로 비교합니다. "인지도 변화", "긍정/부정 비율 변화", "핵심 오해 키워드"를 파악하여 소통 전략을 개선합니다.',
        icon: BarChart2,
      },
      {
        title: '의회·시민단체 동향 모니터링',
        description:
          '지방의회, 시민단체, 지역 언론의 반응을 종합 모니터링합니다. 예산안, 조례 변경, 대형 사업에 대한 이해관계자별 입장을 구조화하여 갈등 해소 전략을 수립합니다.',
        icon: Landmark,
      },
    ],
    workflow: [
      { step: '지역명 + 현안 키워드 입력', detail: '지역 여론 분석 모드 활성화' },
      { step: '지역 커뮤니티 + 뉴스 수집', detail: '주민 의견 집중 수집' },
      { step: 'AI가 주민 감정·쟁점·갈등 구조 분석', detail: '이해관계자별 입장 정리' },
      { step: '정책 소통 전략 리포트 생성', detail: '주민설명회 자료 활용 가능' },
    ],
    keyModules: ['집단별 반응', '거시 여론 구조', '전략 도출', '최종 요약'],
    impactMetrics: [
      { label: '주민 불만 인지', before: '민원 접수 후', after: '온라인 확산 전', icon: Bell },
      { label: '소통 전략', before: '경험 기반', after: '데이터 기반', icon: Lightbulb },
      { label: '여론 수집', before: '공청회 한정', after: '상시 모니터링', icon: Radar },
    ],
    insightQuote:
      '행정의 성공은 정책의 질이 아닌 주민의 수용에 달려있습니다. 여론을 먼저 듣고 소통하세요.',
  },
  '대학 / 교육기관': {
    title: '대학 / 교육기관',
    tagline: '교육 여론의 흐름을 읽다',
    icon: GraduationCap,
    color: 'text-indigo-500',
    painPoints: [
      { icon: AlertTriangle, text: '입시 정책 변경 시 학부모·학생 반응 파악 지연' },
      { icon: Star, text: '대학 평판·순위에 영향을 미치는 온라인 여론 관리 어려움' },
      { icon: Users2, text: '재학생·졸업생 만족도를 실시간으로 파악할 수 없음' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', 'DC갤러리', 'FM코리아'],
      upcoming: ['네이버 카페', '네이버 블로그', '더쿠', '네이버 지식iN'],
      reason:
        'DC갤러리 대학·입시 갤러리와 네이버 입시 카페는 학생·학부모 여론의 중심지입니다. 네이버 블로그의 입시 후기와 대학 생활기는 평판 형성의 핵심 콘텐츠입니다.',
    },
    scenarios: [
      {
        title: '대학 평판 온라인 모니터링',
        description:
          'SKY, 인서울, 지방대 등 대학 평판과 관련된 온라인 여론을 종합 추적합니다. 수시/정시 시즌의 입시 커뮤니티 반응, 취업률 관련 댓글, 캠퍼스 이슈 등을 분석하여 브랜딩 전략에 반영합니다.',
        icon: Award,
      },
      {
        title: '입시 정책 임팩트 분석',
        description:
          '교육부 정책 변경, 대입 전형 변화에 대한 학부모·학생·교사의 반응을 실시간으로 파악합니다. 정책 변화가 해당 대학의 지원율에 미칠 영향을 여론 데이터로 예측합니다.',
        icon: Lightbulb,
      },
      {
        title: '캠퍼스 이슈 위기 관리',
        description:
          '학내 비리, 교수 논란, 학생 사건 등 캠퍼스 이슈가 온라인으로 확산되는 과정을 실시간 추적합니다. 대학 본부의 공식 대응이 여론에 미치는 영향을 분석하고 소통 전략을 제안합니다.',
        icon: ShieldAlert,
      },
    ],
    workflow: [
      { step: '대학명 + 이슈 키워드 입력', detail: '교육 분석 모드 활성화' },
      { step: '입시 커뮤니티 + 뉴스 수집', detail: '학부모·학생 반응 수집' },
      { step: 'AI가 평판·이슈·리스크 분석', detail: '트렌드 변화 자동 추적' },
      { step: '대학 브랜딩 전략 리포트', detail: '입시 홍보 전략 포함' },
    ],
    keyModules: ['메시지 파급력', '집단별 반응', '기회 분석', '전략 도출'],
    impactMetrics: [
      { label: '평판 모니터링', before: '연간 조사', after: '실시간 추적', icon: Radar },
      { label: '이슈 대응', before: '언론 보도 후', after: '확산 초기 감지', icon: Bell },
      {
        label: '학생 의견 수렴',
        before: '설문조사',
        after: '온라인 상시 분석',
        icon: MessageCircle,
      },
    ],
    insightQuote:
      '대학의 미래는 평판에 달려있습니다. 온라인에서 형성되는 평판의 흐름을 데이터로 관리하세요.',
  },
  '스포츠 / e스포츠': {
    title: '스포츠 / e스포츠',
    tagline: '팬의 열정을 데이터로 읽다',
    icon: Dumbbell,
    color: 'text-orange-600',
    painPoints: [
      { icon: Flame, text: '선수 이적·방출 시 팬 반발 규모 예측 어려움' },
      { icon: DollarSign, text: '스폰서십 보고에 팬 반응 데이터 부족' },
      { icon: Activity, text: '경기 결과에 따른 팬 감정 변화 추적 어려움' },
    ],
    recommendedSources: {
      active: ['유튜브', 'DC갤러리', 'FM코리아', '네이버 뉴스', '네이버 댓글'],
      upcoming: ['X (트위터)', 'Reddit', '더쿠', 'TikTok'],
      reason:
        'DC갤러리 야구·축구·e스포츠 갤러리와 FM코리아는 스포츠 팬덤의 핵심 공간입니다. 유튜브 하이라이트 영상 댓글은 팬 반응의 즉각적 지표이며, X(트위터)는 실시간 경기 반응 추적에 최적입니다.',
    },
    scenarios: [
      {
        title: '팬 감정 실시간 분석',
        description:
          '경기 전후, 이적 시장, 감독 교체 등 주요 이벤트에 따른 팬 감정을 실시간으로 추적합니다. 커뮤니티·유튜브·뉴스 댓글에서 팬의 기대·실망·분노·환호를 정량화하여 구단 운영에 반영합니다.',
        icon: Heart,
      },
      {
        title: '스폰서 가치 증명 리포트',
        description:
          '스폰서십 계약 시 팬 반응 데이터를 정량적으로 제시합니다. 브랜드 언급량, 긍정 반응 비율, 팬층 프로필 등을 자동 리포트로 생성하여 스폰서 가치를 데이터로 증명합니다.',
        icon: Trophy,
      },
      {
        title: 'e스포츠 선수·팀 평판 관리',
        description:
          '프로게이머의 방송 발언, 경기 퍼포먼스, 팀 이동에 대한 팬 반응을 종합 분석합니다. e스포츠 특유의 빠른 여론 변화를 실시간으로 추적하고, 선수 브랜딩 전략을 수립합니다.',
        icon: Crosshair,
      },
    ],
    workflow: [
      { step: '팀명/선수명 입력', detail: '스포츠 분석 모드 활성화' },
      { step: '스포츠 커뮤니티 + 뉴스 수집', detail: '팬 반응 집중 수집' },
      { step: 'AI가 팬 감정·이슈·트렌드 분석', detail: '이벤트별 감정 변화 추적' },
      { step: '팬 인사이트 리포트 생성', detail: '스폰서 보고 + 운영 전략' },
    ],
    keyModules: ['감정/프레임 분석', '메시지 파급력', '집단별 반응', '기회 분석'],
    impactMetrics: [
      { label: '팬 반응 파악', before: 'SNS 수동 확인', after: '실시간 자동 분석', icon: Gauge },
      {
        label: '스폰서 리포트',
        before: '수동 작성',
        after: '데이터 자동 생성',
        icon: FileBarChart,
      },
      { label: '위기 대응', before: '사후 수습', after: '선제 대응', icon: ShieldCheck },
    ],
    insightQuote: '팬은 가장 열정적인 고객입니다. 그 열정의 방향을 데이터로 읽고 함께 성장하세요.',
  },
  '법률 / 로펌': {
    title: '법률 / 로펌',
    tagline: '여론재판의 흐름을 데이터로 읽다',
    icon: Briefcase,
    color: 'text-gray-700',
    painPoints: [
      { icon: Scale, text: '여론재판이 실제 판결에 미치는 영향 정량화 어려움' },
      { icon: Eye, text: '의뢰인 관련 온라인 여론 모니터링이 수동적' },
      { icon: AlertTriangle, text: '기업 분쟁 시 상대방 여론전 대응 전략 부재' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', 'DC갤러리', 'FM코리아', '유튜브'],
      upcoming: ['다음 뉴스', 'X (트위터)', '네이버 블로그', '네이버 카페'],
      reason:
        '여론재판은 뉴스 댓글에서 형성되고 커뮤니티에서 증폭됩니다. DC갤러리 법률 관련 갤러리와 유튜브 법률 채널 댓글은 일반인의 법 감정을 파악하는 핵심 소스입니다.',
    },
    scenarios: [
      {
        title: '여론재판 리스크 모니터링',
        description:
          '소송 당사자 관련 온라인 여론의 방향과 강도를 추적합니다. "유죄 확정 분위기", "피해자 동정 여론", "기업 비난" 등 여론 프레임의 변화를 모니터링하여 법적 전략 수립의 보조 자료로 활용합니다.',
        icon: Scale,
      },
      {
        title: '기업 분쟁 여론전 분석',
        description:
          '기업 간 분쟁(특허, 공정거래, 노동) 시 양측의 여론전 현황을 분석합니다. 어느 쪽의 프레임이 여론을 지배하고 있는지, 언론과 온라인의 반응 차이는 무엇인지를 구조적으로 파악합니다.',
        icon: Crosshair,
      },
      {
        title: '판결 전후 여론 임팩트 분석',
        description:
          '주요 판결 전후로 여론의 변화를 추적합니다. 판결에 대한 공정성 인식, 법제도 변화 요구, 관련 기업·인물에 대한 평판 변화를 분석하여 포스트 리티게이션 전략을 지원합니다.',
        icon: BarChart2,
      },
    ],
    workflow: [
      { step: '사건명/당사자명 입력', detail: '법률 분석 모드 활성화' },
      { step: '뉴스·댓글·커뮤니티 여론 수집', detail: '여론 동향 집중 수집' },
      { step: 'AI가 여론 프레임·리스크·영향 분석', detail: '여론 지배 프레임 식별' },
      { step: '소송 전략 보조 리포트 생성', detail: '여론전 분석 + 대응 방향' },
    ],
    keyModules: ['프레임 전쟁 분석', '리스크 지도', '집단별 반응', '전략 도출'],
    impactMetrics: [
      { label: '여론 모니터링', before: '수동 클리핑', after: '자동 실시간 추적', icon: Radar },
      { label: '프레임 분석', before: '주관적 판단', after: 'AI 정량 분석', icon: Brain },
      { label: '전략 수립', before: '경험 기반', after: '데이터 기반', icon: Lightbulb },
    ],
    insightQuote:
      '법정 밖의 여론은 법정 안의 판단에 영향을 줍니다. 여론의 흐름을 데이터로 파악하세요.',
  },
  '프랜차이즈 / 유통': {
    title: '프랜차이즈 / 유통',
    tagline: '브랜드 위기를 기회로 바꾸다',
    icon: ExternalLink,
    color: 'text-amber-600',
    painPoints: [
      { icon: Flame, text: '불매운동·가맹점 갈등이 SNS에서 급속 확산' },
      { icon: ShoppingCart, text: '소비자 불만이 매출 감소로 이어지는 구간 파악 어려움' },
      { icon: MessageCircle, text: '다수 매장·지역의 여론을 통합 관리할 수 없음' },
    ],
    recommendedSources: {
      active: ['네이버 뉴스', '네이버 댓글', 'FM코리아', '클리앙', 'DC갤러리'],
      upcoming: ['네이버 카페', '뽐뿌', '인스타그램', '앱 리뷰', 'X (트위터)'],
      reason:
        'FM코리아·클리앙·뽐뿌는 소비자 불만과 불매운동의 진원지입니다. 네이버 카페(맘카페 등)는 지역별 프랜차이즈 평판을 파악하는 데 핵심이며, 앱 리뷰는 배달앱·커머스 브랜드 평가의 직접 지표입니다.',
    },
    scenarios: [
      {
        title: '불매운동 조기 감지 및 대응',
        description:
          '가격 인상, 품질 논란, 갑질 이슈 등으로 불매운동이 시작되는 초기 단계를 포착합니다. AI가 확산 속도와 규모를 예측하고, "사과문 발표", "가격 환원", "품질 개선 약속" 등 최적 대응 시나리오를 제시합니다.',
        icon: Flame,
      },
      {
        title: '가맹점-본사 갈등 여론 관리',
        description:
          '가맹점주의 불만이 언론·온라인으로 확산되는 과정을 추적합니다. 갈등 이슈의 여론 프레임("갑질 본사" vs "무리한 요구")을 분석하고, 소비자가 어느 쪽에 공감하는지 데이터로 파악하여 소통 전략을 수립합니다.',
        icon: Users2,
      },
      {
        title: '신제품·캠페인 반응 분석',
        description:
          '신메뉴 출시, 할인 이벤트, 콜라보 캠페인에 대한 소비자 반응을 실시간으로 분석합니다. 긍정 반응이 높은 제품/캠페인의 성공 요인을 추출하고, 다음 마케팅 전략에 반영합니다.',
        icon: Rocket,
      },
    ],
    workflow: [
      { step: '브랜드명 + 이슈 키워드 입력', detail: '유통 분석 모드 활성화' },
      { step: '소비자 커뮤니티 + 뉴스 수집', detail: '소비자 반응 집중 수집' },
      { step: 'AI가 브랜드 위기·기회·트렌드 분석', detail: '불매 위험도 자동 산출' },
      { step: '브랜드 관리 전략 리포트 생성', detail: '대응 시나리오 + 마케팅 인사이트' },
    ],
    keyModules: ['위기 시나리오', '메시지 파급력', '감정/프레임 분석', '기회 분석'],
    impactMetrics: [
      { label: '불매 감지', before: '매출 하락 후', after: '온라인 확산 초기', icon: Bell },
      { label: '소비자 인사이트', before: 'CS 데이터만', after: '온라인 여론 통합', icon: Network },
      { label: '대응 속도', before: '위기 후 대응', after: '선제적 위기 관리', icon: ShieldCheck },
    ],
    insightQuote:
      '소비자의 한 줄 댓글이 매출을 좌우합니다. 온라인 여론에서 브랜드의 체온을 실시간으로 체크하세요.',
  },
};

const PRICING = [
  {
    name: 'Starter',
    price: '49',
    unit: '만원/월',
    description: '소규모 팀과 컨설턴트',
    features: [
      '분석 대상 1개',
      '3개 소스 수집',
      '기본 8개 모듈 (Stage 1+2)',
      '월 4회 분석',
      '팀원 3명',
    ],
    cta: '7일 무료 체험',
    popular: false,
  },
  {
    name: 'Professional',
    price: '129',
    unit: '만원/월',
    description: 'PR 에이전시와 기업 홍보팀',
    features: [
      '분석 대상 3개',
      '전체 6개 소스 수집',
      '14개 전체 모듈',
      '월 12회 분석',
      '팀원 10명',
      'PDF 리포트 내보내기',
    ],
    cta: '7일 무료 체험',
    popular: true,
  },
  {
    name: 'Campaign',
    price: '249',
    unit: '만원/월',
    description: '정치 캠프와 대규모 조직',
    features: [
      '분석 대상 5개',
      '무제한 분석',
      '14개 전체 모듈',
      'API 접근',
      '전담 CSM',
      '맞춤 분석 모듈',
    ],
    cta: '상담 신청',
    popular: false,
  },
];

const COMPARISONS = [
  { label: '모니터링 주니어 인건비', cost: '250~350만원/월', scope: '수집만' },
  { label: '소셜 리스닝 도구', cost: '50~300만원/월', scope: '수집 + 감정 분석' },
  {
    label: 'AI SignalCraft',
    cost: '129만원/월',
    scope: '수집 + 분석 + 전략',
    highlight: true as const,
  },
];

function UseCaseDetailModal({
  detail,
  open,
  onOpenChange,
}: {
  detail: UseCaseDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!detail) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn('flex size-11 items-center justify-center rounded-xl bg-primary/10')}
            >
              <detail.icon className={cn('size-6', detail.color)} />
            </div>
            <div>
              <DialogTitle className="text-xl">{detail.title}</DialogTitle>
              <DialogDescription className="mt-0.5 text-sm italic">
                {detail.tagline}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 기존 Pain Points */}
        <div className="mt-2 rounded-lg border border-red-200/50 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="size-4" />
            현재 이런 문제가 있지 않나요?
          </h4>
          <ul className="space-y-2">
            {detail.painPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <p.icon className="mt-0.5 size-4 shrink-0 text-red-400" />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 혁신적 활용 시나리오 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Rocket className="size-4 text-primary" />
            AI SignalCraft 활용 시나리오
          </h4>
          <div className="space-y-3">
            {detail.scenarios.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className="size-4 text-primary" />
                  </div>
                  <h5 className="font-semibold">{s.title}</h5>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 추천 데이터 소스 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4 text-primary" />
            활용 가능한 데이터 소스
          </h4>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <Badge className="shrink-0 bg-primary text-[10px]">수집 중</Badge>
                <span className="text-xs text-muted-foreground">현재 바로 활용 가능</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.recommendedSources.active.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  추가 예정
                </Badge>
                <span className="text-xs text-muted-foreground">곧 지원 예정</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.recommendedSources.upcoming.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <Lightbulb className="mr-1 inline size-3 text-amber-500" />
              {detail.recommendedSources.reason}
            </p>
          </div>
        </div>

        {/* 워크플로우 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-primary" />
            분석 워크플로우
          </h4>
          <div className="relative space-y-0">
            {detail.workflow.map((w, i) => (
              <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {/* 세로선 */}
                {i < detail.workflow.length - 1 && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                )}
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </div>
                <div className="pt-1">
                  <div className="text-sm font-medium">{w.step}</div>
                  <div className="text-xs text-muted-foreground">{w.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 핵심 분석 모듈 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Brain className="size-4 text-primary" />
            핵심 활용 모듈
          </h4>
          <div className="flex flex-wrap gap-2">
            {detail.keyModules.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1.5">
                <Sparkles className="size-3" />
                {m}
              </Badge>
            ))}
          </div>
        </div>

        {/* 임팩트 지표 */}
        <div className="mt-1">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ArrowUpRight className="size-4 text-primary" />
            도입 효과
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {detail.impactMetrics.map((m, i) => (
              <div key={i} className="rounded-lg border p-3 text-center">
                <m.icon className="mx-auto mb-2 size-5 text-primary" />
                <div className="mb-2 text-xs font-medium text-muted-foreground">{m.label}</div>
                <div className="flex items-center justify-center gap-1.5 text-xs">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-950 dark:text-red-400">
                    {m.before}
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-600 dark:bg-green-950 dark:text-green-400">
                    {m.after}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 인사이트 문구 */}
        <div className="mt-2 rounded-lg border-l-4 border-primary bg-primary/5 p-4">
          <p className="text-sm italic leading-relaxed text-foreground/80">
            &ldquo;{detail.insightQuote}&rdquo;
          </p>
        </div>

        {/* CTA */}
        <div className="mt-2 flex justify-center">
          <a
            href="#pricing"
            className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}
            onClick={() => onOpenChange(false)}
          >
            7일 무료 체험 시작
            <ArrowRight className="size-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LandingContent() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const selectedDetail = selectedUseCase ? (USE_CASE_DETAILS[selectedUseCase] ?? null) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="text-lg font-bold">AI SignalCraft</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              기능
            </a>
            <a href="#use-cases" className="hover:text-foreground">
              활용 사례
            </a>
            <a href="#pricing" className="hover:text-foreground">
              가격
            </a>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link href="/dashboard" className={cn(buttonVariants({ size: 'sm' }))}>
                대시보드
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  로그인
                </Link>
                <a href="#pricing" className={cn(buttonVariants({ size: 'sm' }))}>
                  무료 체험
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <Badge variant="secondary" className="mb-6">
            <Zap className="mr-1 size-3" />
            14개 AI 분석 모듈로 여론을 전략으로
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            여론 수집에서 멈추지 마세요.
            <br />
            <span className="text-primary">전략까지 자동으로.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            한국 온라인 여론을 6개 소스에서 자동 수집하고, AI가 리스크·기회·전략을 분석하여 실행
            가능한 리포트를 생성합니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#pricing" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              7일 무료 체험 시작
              <ArrowRight className="size-4" />
            </a>
            <a href="#features" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              기능 살펴보기
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            카드 등록 없이 시작 · 설치 불필요 · 5분 안에 첫 분석
          </p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-b bg-muted/30 py-8">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">6개</div>
              <div className="text-sm text-muted-foreground">데이터 소스</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">14개</div>
              <div className="text-sm text-muted-foreground">AI 분석 모듈</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">1~3시간</div>
              <div className="text-sm text-muted-foreground">분석 완료</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">90%+</div>
              <div className="text-sm text-muted-foreground">시간 절감</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              기존 도구는 &quot;무슨 말이 있다&quot;에서 멈춥니다
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              AI SignalCraft는 &quot;그래서 어떻게 할 것인가&quot;까지 제시합니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-red-200/50 dark:border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-600">기존 방식의 한계</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>✕ 수동 클리핑에 주 10~20시간</p>
                <p>✕ 단순 감정 분석 (긍정/부정 비율)</p>
                <p>✕ &quot;그래서 뭘 해야 하는데?&quot; 답변 못함</p>
                <p>✕ 리포트 작성에 추가 2~3일</p>
              </CardContent>
            </Card>
            <Card className="md:scale-105 ring-2 ring-primary/20">
              <CardHeader>
                <Badge className="mb-2 w-fit">AI SignalCraft</Badge>
                <CardTitle className="text-primary">전략 도구</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>✓ 5개 소스 자동 수집 (클릭 한 번)</p>
                <p>✓ 14개 모듈 심층 분석</p>
                <p>
                  <strong>✓ 전략·리스크·시나리오까지 제시</strong>
                </p>
                <p>✓ 종합 리포트 자동 생성 (PDF)</p>
              </CardContent>
            </Card>
            <Card className="border-muted">
              <CardHeader>
                <CardTitle className="text-muted-foreground">기존 소셜 리스닝</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>△ 자동 수집은 되지만</p>
                <p>△ 감정 분석까지만</p>
                <p>✕ 전략 도출 없음</p>
                <p>✕ 한국 커뮤니티 미지원</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section id="features" className="border-t bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          {/* 현재 수집 중 */}
          <div className="mb-16">
            <div className="mb-8 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">데이터 소스</h2>
              <p className="text-muted-foreground">
                클릭 한 번으로 뉴스, 댓글, 영상, 커뮤니티를 동시에 수집합니다.
              </p>
            </div>
            <div className="mb-6 flex items-center gap-3">
              <Badge className="shrink-0 bg-primary">수집 중</Badge>
              <span className="text-sm font-medium">현재 지원하는 6개 소스</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
              {ACTIVE_SOURCES.map((source) => (
                <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer">
                  <Card className="text-center ring-1 ring-primary/20 transition-colors hover:bg-primary/5">
                    <CardContent className="flex flex-col items-center gap-2 pt-2">
                      <source.icon className="size-8 text-primary" />
                      <span className="text-sm font-medium">{source.name}</span>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>

          {/* 추가 예정 소스 */}
          <div>
            <div className="mb-6 flex items-center gap-3">
              <Badge variant="outline" className="shrink-0">
                추가 예정
              </Badge>
              <span className="text-sm text-muted-foreground">확장 예정 소스</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {UPCOMING_SOURCE_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="rounded-lg border border-dashed border-border/60 p-4"
                >
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {group.sources.map((source) => (
                      <a
                        key={source.name}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                      >
                        <source.icon className="size-3.5" />
                        <span>{source.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 14 Analysis Modules */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">14개 AI 분석 모듈</h2>
            <p className="text-muted-foreground">
              단순 감정 분석을 넘어, 전략적 인사이트를 단계별로 도출합니다.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {MODULES.map((group) => (
              <Card key={group.stage}>
                <CardHeader>
                  <Badge variant="outline" className={group.color}>
                    {group.stage}
                  </Badge>
                  <CardTitle>{group.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm">
                        <Brain className="size-4 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Flow */}
      <section className="border-t bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">클릭 한 번, 전략 리포트까지</h2>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
            {[
              {
                icon: Globe,
                step: '1',
                title: '키워드 입력',
                desc: '분석 대상과 기간 설정',
              },
              {
                icon: Zap,
                step: '2',
                title: '자동 수집',
                desc: '6개 소스 병렬 크롤링',
              },
              {
                icon: Brain,
                step: '3',
                title: 'AI 분석',
                desc: '14개 모듈 단계별 실행',
              },
              {
                icon: BarChart3,
                step: '4',
                title: '전략 리포트',
                desc: '실행 가능한 인사이트',
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <item.icon className="size-6 text-primary" />
                </div>
                <Badge variant="outline" className="mb-2">
                  Step {item.step}
                </Badge>
                <h3 className="mb-1 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">누가 사용하나요?</h2>
            <p className="text-muted-foreground">
              여론 분석이 필요한 모든 조직에서 활용할 수 있습니다.
            </p>
          </div>
          <div className="space-y-12">
            {USE_CASE_CATEGORIES.map((category) => (
              <div key={category.label}>
                <div className="mb-6 flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{category.label}</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {category.cases.map((uc) => (
                    <Card
                      key={uc.title}
                      className="group cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
                      onClick={() => setSelectedUseCase(uc.title)}
                    >
                      <CardHeader>
                        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                          <uc.icon className="size-5 text-primary" />
                        </div>
                        <CardTitle className="text-base">{uc.title}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {uc.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="mr-1 size-3" />
                            {uc.highlight}
                          </Badge>
                          <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                            자세히 보기 →
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">투명한 가격</h2>
            <p className="text-muted-foreground">
              7일 무료 체험 · 카드 등록 불필요 · 연간 결제 시 2개월 무료
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PRICING.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? 'ring-2 ring-primary md:scale-105' : ''}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.popular && <Badge>추천</Badge>}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.unit}</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta === '상담 신청' ? 'mailto:krdn.net@gmail.com' : '/login'}
                    className={cn(
                      buttonVariants({
                        variant: plan.popular ? 'default' : 'outline',
                        size: 'lg',
                      }),
                      'w-full',
                    )}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Cost comparison */}
          <div className="mx-auto mt-16 max-w-2xl">
            <h3 className="mb-6 text-center text-xl font-semibold">비용 비교</h3>
            <div className="space-y-3">
              {COMPARISONS.map((c) => (
                <div
                  key={c.label}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4',
                    'highlight' in c &&
                      c.highlight &&
                      'border-primary/30 bg-primary/5 ring-1 ring-primary/20',
                  )}
                >
                  <div>
                    <div className="font-medium">{c.label}</div>
                    <div className="text-sm text-muted-foreground">{c.scope}</div>
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold',
                      'highlight' in c && c.highlight && 'text-primary',
                    )}
                  >
                    {c.cost}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            여론 분석, 전략으로 바꿀 준비가 되셨나요?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            7일 무료 체험으로 시작하세요. 카드 등록 없이, 5분 안에 첫 분석을 실행할 수 있습니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#pricing" className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}>
              무료 체험 시작
              <ArrowRight className="size-4" />
            </a>
            <a
              href="mailto:krdn.net@gmail.com"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              영업팀 상담
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-medium text-foreground">AI SignalCraft</span>
          </div>
          <p>&copy; 2026 AI SignalCraft. All rights reserved.</p>
        </div>
      </footer>

      {/* Use Case Detail Modal */}
      <UseCaseDetailModal
        detail={selectedDetail}
        open={!!selectedUseCase}
        onOpenChange={(open) => {
          if (!open) setSelectedUseCase(null);
        }}
      />
    </div>
  );
}
