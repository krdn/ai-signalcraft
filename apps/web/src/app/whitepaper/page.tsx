import type { Metadata } from 'next';
import { WhitepaperDeck } from '@/components/whitepaper/whitepaper-deck';

export const metadata: Metadata = {
  title: 'AI SignalCraft 제품 소개 — 영업용 화이트페이퍼',
  description:
    '14개 AI 분석 모듈, 4단계 파이프라인, 모델 전략을 한 장씩 슬라이드로 설명합니다. 인쇄 시 PDF 한 페이지당 한 슬라이드로 저장됩니다.',
  robots: { index: false, follow: false },
};

export default function WhitepaperPage() {
  return <WhitepaperDeck />;
}
