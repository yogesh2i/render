import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@remotion/renderer'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure FFmpeg binary is included
      config.externals.push({
        '@remotion/renderer': 'commonjs @remotion/renderer',
        '@ffmpeg-installer/ffmpeg': 'commonjs @ffmpeg-installer/ffmpeg',
        'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
      });
    }
    return config;
  },
};

export default nextConfig;
