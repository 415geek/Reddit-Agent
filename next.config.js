/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 上不需要 standalone(平台自行打包);自托管 Docker 需要
  output: process.env.VERCEL ? undefined : 'standalone',
  experimental: { serverActions: { allowedOrigins: ['*'] } },
}
module.exports = nextConfig
