import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false, // セキュリティのためX-Powered-Byヘッダーを削除
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
