import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  noPadding,
}: SectionCardProps) {
  return (
    <div className="rounded-2xl bg-surface-0 shadow-card">
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            {title && (
              <h2 className="text-body font-semibold text-charcoal">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-caption text-charcoal-muted">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
    </div>
  );
}
