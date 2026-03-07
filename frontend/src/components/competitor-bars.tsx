interface CompetitorData {
  name: string;
  score: number;
  isYou?: boolean;
}

interface CompetitorBarsProps {
  data: CompetitorData[];
}

export function CompetitorBars({ data }: CompetitorBarsProps) {
  const sorted = [...data].sort((a, b) => b.score - a.score);
  const max = Math.max(...sorted.map((d) => d.score), 1);

  return (
    <div className="space-y-3">
      {sorted.map((item) => (
        <div key={item.name} className="flex items-center gap-4">
          <span
            className={`w-32 truncate text-body-sm text-right ${
              item.isYou ? "font-semibold text-charcoal" : "text-charcoal-light"
            }`}
          >
            {item.name}
            {item.isYou && (
              <span className="ml-1.5 text-caption text-primary-600">(you)</span>
            )}
          </span>
          <div className="flex-1 h-7 rounded-lg bg-surface-100 overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all duration-700 ease-out ${
                item.isYou ? "bg-primary-500" : "bg-surface-300"
              }`}
              style={{ width: `${(item.score / max) * 100}%` }}
            />
          </div>
          <span
            className={`w-10 text-right tabular-nums text-body-sm ${
              item.isYou ? "font-semibold text-charcoal" : "text-charcoal-muted"
            }`}
          >
            {item.score.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}
