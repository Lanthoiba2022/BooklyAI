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
      canvas: false,
    };

    // Fully stub 'canvas' so webpack doesn't try to bundle it
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
