"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrand } from "./brand-context";
import { useAuth } from "./auth-context";
import { LogOut, User, Shield } from "lucide-react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/prompt-scores", label: "Prompt Scores" },
  { href: "/weekly-summary", label: "Weekly Summary" },
  { href: "/data-health", label: "Data Health" },
  { href: "/billing", label: "Billing" },
];

export function Nav() {
  const pathname = usePathname();
  const { brands, selectedBrand, setSelectedBrand, loading } = useBrand();
  const { user, signOut, isSuperadmin } = useAuth();

  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  if (isAuthPage) return null;

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

          <div className="flex items-center gap-4">
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

            {user && isSuperadmin && (
              <Link
                href="/admin"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-medium rounded-lg transition-colors ${
                  pathname.startsWith("/admin")
                    ? "bg-primary-50 text-primary-700"
                    : "text-charcoal-muted hover:text-charcoal hover:bg-surface-100"
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}

            {user && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-1.5">
                  <User className="h-4 w-4 text-charcoal-muted" />
                  <span className="text-body-sm text-charcoal-light">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="rounded-lg p-2 text-charcoal-muted transition-colors hover:bg-surface-100 hover:text-charcoal"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
