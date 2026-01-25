import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Static export for Cloudflare Pages
  output: 'export',
  distDir: 'out',
  
  // Image optimization - disabled for static export
  images: {
    unoptimized: true,
  },
  
  // Asset prefix for proper loading
  assetPrefix: undefined,
  basePath: '',
  
  // Compression
  compress: true,
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    poweredByHeader: false,
    generateEtags: false,
  }),
};

export default nextConfig;
