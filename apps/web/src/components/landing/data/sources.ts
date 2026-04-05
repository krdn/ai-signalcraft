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

export const ACTIVE_SOURCES = [
  { name: '네이버 뉴스', icon: Globe, url: 'https://news.naver.com' },
  { name: '네이버 댓글', icon: MessageSquareWarning, url: 'https://news.naver.com' },
  { name: '유튜브', icon: BarChart3, url: 'https://www.youtube.com' },
  { name: 'DC갤러리', icon: Users, url: 'https://www.dcinside.com' },
  { name: 'FM코리아', icon: TrendingUp, url: 'https://www.fmkorea.com' },
  { name: '클리앙', icon: Layers, url: 'https://www.clien.net' },
];

export const UPCOMING_SOURCE_GROUPS = [
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
