"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrand } from "./brand-context";

const links = [
  { href: "/", label: "Overview" },
  { href: "/prompt-scores", label: "Prompt Scores" },
  { href: "/weekly-summary", label: "Weekly Summary" },
  { href: "/data-health", label: "Data Health" },
];

export function Nav() {
  const pathname = usePathname();
  const { brands, selectedBrand, setSelectedBrand, loading } = useBrand();

  return (
    <header className="glass-surface sticky top-0 z-50">
      <div className="section-container">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-10">
            <span className="text-heading-sm text-charcoal tracking-tight">
              KnewSearch
            </span>
            <nav className="flex gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 text-body-sm rounded-lg transition-colors ${
                      active
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-charcoal-muted hover:text-charcoal hover:bg-surface-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {!loading && brands.length > 0 && (
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-1.5 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </header>
  );
}
