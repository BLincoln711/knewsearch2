interface SectionHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  label,
  title,
  subtitle,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div
      className={`max-w-3xl ${
        align === "center" ? "mx-auto text-center" : ""
      } mb-14 sm:mb-16`}
    >
      {label && (
        <span className="inline-block text-body-sm font-semibold text-accent-600 tracking-wide uppercase mb-3">
          {label}
        </span>
      )}
      <h2 className="text-heading-lg sm:text-display-sm font-bold text-slate-900">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-body-lg text-slate-500 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
