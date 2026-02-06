"use client";

import { useAuth } from "@/components/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

const adminLinks = [
  { href: "/admin", label: "Clients" },
  { href: "/admin/clients/new", label: "New Client" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isSuperadmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperadmin) {
      router.replace("/");
    }
  }, [user, loading, isSuperadmin, router]);

  if (loading) return <LoadingSpinner />;
  if (!user || !isSuperadmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary-600" />
          <h1 className="text-heading tracking-tight text-charcoal">Admin</h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-body-sm text-charcoal-muted hover:text-charcoal transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <nav className="flex gap-1 border-b border-surface-200/60 pb-px">
        {adminLinks.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2.5 text-body-sm font-medium rounded-t-lg transition-colors ${
                active
                  ? "bg-surface-0 text-primary-700 border-b-2 border-primary-600"
                  : "text-charcoal-muted hover:text-charcoal hover:bg-surface-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
