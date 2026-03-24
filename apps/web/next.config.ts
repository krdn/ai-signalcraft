import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-signalcraft/core', '@ai-signalcraft/collectors'],
};

export default nextConfig;
