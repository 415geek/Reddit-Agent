import { Badge } from '@/components/ui/badge'

interface IntentBadgeProps { intent: string }

export function IntentBadge({ intent }: IntentBadgeProps) {
  const variant = intent === 'high' ? 'high' : intent === 'medium' ? 'medium' : intent === 'low' ? 'low' : 'none'
  const labels: Record<string, string> = { high: '🔥 High', medium: '⚡ Medium', low: '○ Low', none: '— None' }
  return <Badge variant={variant}>{labels[intent] || intent}</Badge>
}
