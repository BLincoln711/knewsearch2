interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16 px-6 text-center">
      <p className="text-lg font-medium text-gray-600">{title}</p>
      <p className="mt-2 text-sm text-gray-400 max-w-md">{message}</p>
    </div>
  );
}
