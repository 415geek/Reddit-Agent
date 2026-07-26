import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '生意脑回路 — AI 内容工厂',
  description: '90秒看懂商业、消费与财富背后的隐藏规则。选题→脚本→分镜→审批→发布→复盘的内容流水线后台。',
  // 存到主屏后按独立 App 打开,不带 Safari 的地址栏和工具栏
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: '生意脑回路' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 铺满到刘海和home条下面,再靠 env(safe-area-inset-*) 把内容让开——
  // 不这样的话 iPhone 上底部导航会被系统手势条压住
  viewportFit: 'cover',
  // 审批时要看清封面和分镜,不该禁止缩放;只挡住双击误放大
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
