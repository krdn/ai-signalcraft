import type { Metadata } from 'next';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';

export const metadata: Metadata = {
  title: 'AI 분석 리포트 — AI SignalCraft',
  description:
    'AI SignalCraft가 실제 수행한 한국 온라인 여론 분석 결과를 공개합니다. 로그인 없이 분석 리포트를 확인하세요.',
  openGraph: {
    title: 'AI 분석 리포트 — AI SignalCraft',
    description: 'AI SignalCraft가 실제 수행한 한국 온라인 여론 분석 결과를 공개합니다.',
    type: 'website',
  },
};

export default function ReportsPage() {
  return <ReportsDashboard />;
}
