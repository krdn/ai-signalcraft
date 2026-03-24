import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-signalcraft/core', '@ai-signalcraft/collectors'],
  serverExternalPackages: ['playwright-core', 'playwright', 'bullmq', 'ioredis', 'resend'],
};

export default nextConfig;
