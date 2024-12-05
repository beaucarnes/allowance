/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  distDir: 'dist'
}

module.exports = nextConfig 