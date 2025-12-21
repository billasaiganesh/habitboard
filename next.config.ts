import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // strongly recommended to avoid build failing on lint while you're iterating:
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }
};

export default nextConfig;
