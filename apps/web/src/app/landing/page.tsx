import type { Metadata } from 'next';
import { LandingContent } from './landing-content';

export const metadata: Metadata = {
  title: 'AI SignalCraft — AI 기반 여론 분석 전략 플랫폼',
  description:
    '한국 온라인 여론을 자동 수집하고 14개 AI 분석 모듈로 실행 가능한 전략 리포트를 생성합니다. 수일 걸리던 분석을 1~3시간으로.',
  openGraph: {
    title: 'AI SignalCraft — AI 기반 여론 분석 전략 플랫폼',
    description: '한국 온라인 여론을 자동 수집하고 14개 AI 모듈로 전략 리포트를 생성합니다.',
    type: 'website',
  },
};

export default function LandingPage() {
  return <LandingContent />;
}
