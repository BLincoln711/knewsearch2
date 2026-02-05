interface KpiTileProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export function KpiTile({ label, value, subtitle }: KpiTileProps) {
  return (
    <div className="rounded-2xl bg-surface-0 p-6 shadow-card transition-shadow hover:shadow-card-hover">
      <p className="text-caption font-medium text-charcoal-muted">{label}</p>
      <p className="mt-2 text-heading-sm tracking-tight text-charcoal">{value}</p>
      {subtitle && (
        <p className="mt-1 text-caption text-charcoal-faint">{subtitle}</p>
      )}
    </div>
  );
}
