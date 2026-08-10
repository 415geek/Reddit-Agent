interface ScoreBarProps { score: number; max?: number }

export function ScoreBar({ score, max = 10 }: ScoreBarProps) {
  const pct = Math.min(100, (score / max) * 100)
  const color = score >= 8 ? 'bg-red-500' : score >= 6 ? 'bg-orange-400' : score >= 4 ? 'bg-yellow-400' : 'bg-gray-300'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-semibold w-6 text-right ${score >= 8 ? 'text-red-600' : score >= 6 ? 'text-orange-500' : score >= 4 ? 'text-yellow-600' : 'text-gray-400'}`}>
        {score}
      </span>
    </div>
  )
}
