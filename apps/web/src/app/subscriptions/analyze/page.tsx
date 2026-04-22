import type { Metadata } from 'next';
import SubscriptionAnalyzeContent from './subscription-analyze-content';

export const metadata: Metadata = {
  title: '구독 분석 실행',
};

export default function SubscriptionAnalyzePage() {
  return <SubscriptionAnalyzeContent />;
}
