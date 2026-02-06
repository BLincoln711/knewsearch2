"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { AdminClientList, AdminClient } from "@/lib/api";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Users, ChevronRight, Plus } from "lucide-react";

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: "bg-positive-50 text-positive-700",
    trialing: "bg-primary-50 text-primary-700",
    past_due: "bg-amber-50 text-amber-700",
    canceled: "bg-red-50 text-red-700",
    suspended: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${
        colors[status] || "bg-surface-100 text-charcoal-muted"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminClientsPage() {
  const authedFetch = useAuthedFetch();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch<AdminClientList>("/admin/clients")
      .then((res) => setClients(res.clients))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authedFetch]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  if (clients.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No clients yet"
          message="Create your first client to start managing AI search visibility accounts."
        />
        <div className="flex justify-center">
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add First Client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-charcoal-muted">
          {clients.length} client{clients.length !== 1 ? "s" : ""}
        </p>
        <Link
          href="/admin/clients/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Client
        </Link>
      </div>

      <div className="rounded-2xl bg-surface-0 shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-200/60">
              <th className="text-left px-6 py-3.5 text-caption font-semibold text-charcoal-muted">
                Client
              </th>
              <th className="text-left px-6 py-3.5 text-caption font-semibold text-charcoal-muted">
                Brands
              </th>
              <th className="text-left px-6 py-3.5 text-caption font-semibold text-charcoal-muted">
                Status
              </th>
              <th className="text-left px-6 py-3.5 text-caption font-semibold text-charcoal-muted">
                Subscription
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.client_id}
                className="border-b border-surface-200/40 last:border-0 hover:bg-surface-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50">
                      <Users className="h-4 w-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-body-sm font-medium text-charcoal">
                        {client.name}
                      </p>
                      <p className="text-caption text-charcoal-faint">
                        {client.client_id}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {client.brands.slice(0, 3).map((brand) => (
                      <span
                        key={brand}
                        className="inline-flex items-center rounded-md bg-surface-100 px-2 py-0.5 text-caption text-charcoal-light"
                      >
                        {brand}
                      </span>
                    ))}
                    {client.brands.length > 3 && (
                      <span className="text-caption text-charcoal-faint">
                        +{client.brands.length - 3} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">{statusBadge(client.status)}</td>
                <td className="px-6 py-4">
                  {client.subscription_status
                    ? statusBadge(client.subscription_status)
                    : <span className="text-caption text-charcoal-faint">--</span>}
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/admin/clients/${client.client_id}`}
                    className="text-charcoal-muted hover:text-charcoal transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
