export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-surface-0 p-6 shadow-card">
      <div className="h-4 w-24 rounded bg-surface-100" />
      <div className="mt-3 h-8 w-20 rounded bg-surface-100" />
      <div className="mt-2 h-3 w-32 rounded bg-surface-100" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="animate-pulse rounded-2xl bg-surface-0 shadow-card">
      <div className="px-6 py-5">
        <div className="h-4 w-40 rounded bg-surface-100" />
      </div>
      <div className="p-6">
        <div className="h-72 w-full rounded-xl bg-surface-50" />
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="animate-pulse rounded-2xl bg-surface-0 shadow-card">
      <div className="px-6 py-5">
        <div className="h-4 w-32 rounded bg-surface-100" />
      </div>
      <div className="divide-y divide-surface-100 px-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <div className="h-4 w-48 rounded bg-surface-100" />
            <div className="h-4 w-16 rounded bg-surface-100" />
            <div className="h-4 w-16 rounded bg-surface-100" />
            <div className="h-4 w-12 rounded bg-surface-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="animate-pulse">
        <div className="h-7 w-48 rounded bg-surface-100" />
        <div className="mt-2 h-4 w-64 rounded bg-surface-100" />
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonChart />
    </div>
  );
}
