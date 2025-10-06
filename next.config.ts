import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    // Keep minimal fallbacks; pdfjs is loaded via CDN in the client
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
