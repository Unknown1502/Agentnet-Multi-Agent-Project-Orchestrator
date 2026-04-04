import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Prevent Node.js-only packages from being bundled for the Edge runtime
  serverExternalPackages: ["@upstash/redis"],
};

export default nextConfig;
