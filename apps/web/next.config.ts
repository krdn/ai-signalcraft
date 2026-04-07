import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@ai-signalcraft/core',
    '@ai-signalcraft/collectors',
    '@krdn/ai-analysis-kit/gateway',
  ],
  serverExternalPackages: [
    'playwright-core',
    'playwright',
    'bullmq',
    'ioredis',
    'resend',
    'ai-sdk-provider-gemini-cli',
    '@google/gemini-cli-core',
  ],
  // 네이밍 재설계 마이그레이션 (Phase 4)
  // 레거시 경로 → 신규 경로로 permanent=false (301 아닌 302)
  // Phase 6에서 구 페이지 파일 제거 후 permanent=true로 승격
  async redirects() {
    return [
      // 파트너 포털: /partner/clients → /partner/customers
      { source: '/partner/clients', destination: '/partner/customers', permanent: false },
      // 랜딩: /partner-program → /programs
      { source: '/partner-program', destination: '/programs', permanent: false },
    ];
  },
};

export default nextConfig;
