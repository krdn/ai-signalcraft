import dynamic from 'next/dynamic';

const SubscriptionAnalyzeClient = dynamic(() => import('./subscription-analyze-client'), {
  ssr: false,
});

export default function SubscriptionAnalyzePage() {
  return <SubscriptionAnalyzeClient />;
}
