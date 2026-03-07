import { Check, X } from "lucide-react";

interface Platform {
  name: string;
  mentioned: boolean;
}

interface PlatformPillsProps {
  platforms: Platform[];
}

export function PlatformPills({ platforms }: PlatformPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {platforms.map((p) => (
        <div
          key={p.name}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-medium ${
            p.mentioned
              ? "bg-positive-50 text-positive-700"
              : "bg-surface-100 text-charcoal-faint"
          }`}
        >
          {p.mentioned ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
          {p.name}
        </div>
      ))}
    </div>
  );
}
