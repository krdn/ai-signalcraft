import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@ai-signalcraft/core', '@ai-signalcraft/collectors'],
  serverExternalPackages: [
    'playwright-core',
    'playwright',
    'bullmq',
    'ioredis',
    'resend',
    'ai-sdk-provider-gemini-cli',
    '@google/gemini-cli-core',
  ],
};

export default nextConfig;
