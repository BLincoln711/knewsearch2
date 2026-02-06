import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number | null;
  deltaLabel?: string;
  icon?: ReactNode;
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
}: StatCardProps) {
  const deltaColor =
    delta === undefined || delta === null
      ? "text-charcoal-faint"
      : delta > 0
        ? "text-positive-600"
        : delta < 0
          ? "text-red-500"
          : "text-charcoal-faint";

  const DeltaIcon =
    delta === undefined || delta === null
      ? null
      : delta > 0
        ? TrendingUp
        : delta < 0
          ? TrendingDown
          : Minus;

  return (
    <div className="group rounded-2xl bg-surface-0 p-6 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <p className="text-caption font-medium text-charcoal-muted">{label}</p>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            {icon}
          </div>
        )}
      </div>
      <p className="mt-2 text-heading-sm tracking-tight text-charcoal">
        {value}
      </p>
      {delta !== undefined && delta !== null && (
        <div className={`mt-2 flex items-center gap-1 text-caption font-medium ${deltaColor}`}>
          {DeltaIcon && <DeltaIcon className="h-3.5 w-3.5" />}
          <span>
            {delta > 0 ? "+" : ""}
            {typeof delta === "number" ? delta.toFixed(1) : delta}
          </span>
          {deltaLabel && (
            <span className="text-charcoal-faint font-normal">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
