interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-200/70 ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6">
      <Skeleton className="w-10 h-10 rounded-xl mb-4" />
      <Skeleton className="h-5 w-2/3 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-6">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-10 w-20 mb-3" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
        />
      ))}
    </div>
  );
}
