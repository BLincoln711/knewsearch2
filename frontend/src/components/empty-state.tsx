interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-0 py-20 px-6 text-center shadow-soft">
      <p className="text-body-lg font-semibold text-charcoal">{title}</p>
      <p className="mt-2 text-body-sm text-charcoal-muted max-w-md">{message}</p>
    </div>
  );
}
