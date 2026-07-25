export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SCORE_WEIGHTS } from '@/lib/domain'

const WEIGHT_LABELS: Record<string, string> = {
  conflict: '点击冲突',
  relevance: '普通人相关性',
  emotion: '情绪张力',
  freshness: '新鲜程度',
  story: '能否讲出故事',
  credibility: '信息可信度',
  conversion: '商业转化价值',
}

export default function SettingsPage() {
  const aiMock = process.env.AI_MOCK === '1'
  const mediaProvider = process.env.MEDIA_PROVIDER || 'mock'
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY)
  const hasTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  const hasArk = Boolean(process.env.ARK_API_KEY)
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">运行配置一览(通过 .env 修改,重启生效)</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">运行模式</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-40 text-gray-500">文本模型</span>
            <Badge variant={hasAnthropicKey && !aiMock ? 'low' : 'medium'}>
              {aiMock ? 'AI_MOCK(fixture)' : hasAnthropicKey ? model : '缺少 ANTHROPIC_API_KEY'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-40 text-gray-500">媒体生成</span>
            <Badge variant={mediaProvider === 'volcengine' ? 'low' : 'medium'}>
              {mediaProvider === 'volcengine' ? `火山引擎 ${hasArk ? '✓' : '(缺 ARK_API_KEY)'}` : 'mock 占位'}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-40 text-gray-500">Telegram 审批通知</span>
            <Badge variant={hasTelegram ? 'low' : 'none'}>{hasTelegram ? '已配置' : '未配置(仅网页审批)'}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-40 text-gray-500">抖音开放平台</span>
            <Badge variant="none">Phase 3(当前人工发布)</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">选题评分权重</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(SCORE_WEIGHTS).map(([k, w]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-40 text-gray-500">{WEIGHT_LABELS[k]}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-xs">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${w * 400}px`, maxWidth: '100%' }} />
              </div>
              <span className="font-medium">{Math.round(w * 100)}%</span>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-2">权重定义在 lib/domain.ts,提示词在 lib/prompts/index.ts。修改后重新部署生效。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">合规清单</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-1.5">
          <p>✅ 发布时勾选平台的AI生成内容声明(2025-09-01 起 AI 内容须加标识)</p>
          <p>✅ 片尾或简介注明「AI辅助创作,内容仅作知识科普」</p>
          <p>✅ 不删除工具自动添加的合规AI标识</p>
          <p>✅ 不使用真实人物的脸和声音做未经授权的内容</p>
          <p>✅ 不荐股、不预测买卖点、不承诺收益、不推销金融产品(选题阶段自动风险淘汰)</p>
        </CardContent>
      </Card>
    </div>
  )
}
