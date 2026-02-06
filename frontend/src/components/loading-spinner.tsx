export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-200 border-t-primary-600" />
    </div>
  );
}
