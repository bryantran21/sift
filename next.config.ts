import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Drizzle + postgres.js run in the Node runtime; don't bundle them.
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
