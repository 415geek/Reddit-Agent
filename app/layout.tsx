import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '生意脑回路 — AI 内容工厂',
  description: '90秒看懂商业、消费与财富背后的隐藏规则。选题→脚本→分镜→审批→发布→复盘的内容流水线后台。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
