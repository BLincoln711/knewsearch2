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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-gray-900 tracking-tight">
              KnewSearch
            </span>
            <nav className="flex gap-1">
              {links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 text-sm rounded-md transition-colors ${
                      active
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
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
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
