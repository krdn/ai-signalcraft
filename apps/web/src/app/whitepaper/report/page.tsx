import type { Metadata } from 'next';
import { WhitepaperReport } from '@/components/whitepaper/whitepaper-report';

export const metadata: Metadata = {
  title: 'AI SignalCraft 종합 기술 리포트 — 14개 모듈 상세 명세',
  description:
    '14개 AI 분석 모듈의 작동 원리, 방법론, 이론적 근거, 학술 출처를 모두 담은 영업·기술 리포트. PDF 다운로드 지원.',
  robots: { index: false, follow: false },
};

export default function WhitepaperReportPage() {
  return <WhitepaperReport />;
}
