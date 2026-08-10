/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { serverActions: { allowedOrigins: ['voice.restaurantiq.ai'] } },
}
module.exports = nextConfig
