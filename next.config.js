/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { dev }) => {
    if (dev) {
      // Disables Webpack disk pack caching on Windows to prevent ENOENT chunk corruption
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
