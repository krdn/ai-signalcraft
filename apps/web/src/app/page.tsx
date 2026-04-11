import type { Metadata } from 'next';
import { LandingContent } from '@/components/landing/landing-content';

export const metadata: Metadata = {
  title: 'AI SignalCraft — AI 기반 여론 분석 전략 플랫폼',
  description:
    '한국 온라인 여론을 자동 수집하고 18개 AI 분석 모듈로 실행 가능한 전략 리포트를 생성합니다. 지식 그래프와 시맨틱 검색으로 인사이트를 연결합니다.',
  openGraph: {
    title: 'AI SignalCraft — AI 기반 여론 분석 전략 플랫폼',
    description:
      '한국 온라인 여론을 자동 수집하고 18개 AI 모듈로 전략 리포트를 생성합니다. 지식 그래프와 시맨틱 검색 탑재.',
    type: 'website',
  },
};

export default function HomePage() {
  return <LandingContent />;
}
