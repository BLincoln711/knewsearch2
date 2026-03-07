interface VisibilityScoreProps {
  score: number;
  delta?: number;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-positive-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function ringColor(score: number) {
  if (score >= 70) return "stroke-positive-500";
  if (score >= 40) return "stroke-amber-500";
  return "stroke-red-500";
}

export function VisibilityScore({ score, delta }: VisibilityScoreProps) {
  const pct = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="8"
            className="stroke-surface-100"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${ringColor(score)} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-heading-lg font-bold tabular-nums ${scoreColor(score)}`}>
            {score.toFixed(0)}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-caption font-medium ${
                delta > 0 ? "text-positive-600" : "text-red-500"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 text-caption font-medium text-charcoal-muted">
        Visibility Score
      </p>
    </div>
  );
}
