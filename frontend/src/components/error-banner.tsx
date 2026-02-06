interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-body-sm text-red-700">
      {message}
    </div>
  );
}
