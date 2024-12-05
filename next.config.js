/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  typescript: {
    // Don't run TypeScript during build for functions directory
    ignoreBuildErrors: true
  }
}

module.exports = nextConfig 