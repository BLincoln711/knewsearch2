"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { HealthResponse, OverviewResponse } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";

interface HealthState {
  api: { status: string; service: string } | null;
  lastScoreDate: string | null;
  lastSummaryDate: string | null;
  apiError: string | null;
}

export default function DataHealthPage() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const authedFetch = useAuthedFetch();
  const [health, setHealth] = useState<HealthState>({
    api: null,
    lastScoreDate: null,
    lastSummaryDate: null,
    apiError: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const fetchHealth = authedFetch<HealthResponse>("/health")
      .then((res) => res)
      .catch((err) => ({ error: err.message }));

    const fetchLastScore = selectedBrand
      ? authedFetch<OverviewResponse>("/overview", { brand: selectedBrand })
          .then((res) =>
            res.data.length > 0
              ? res.data[res.data.length - 1].event_date
              : null
          )
          .catch(() => null)
      : Promise.resolve(null);

    const fetchLastSummary = selectedBrand
      ? authedFetch<{ created_at?: string; detail?: string }>("/weekly-summary", {
          brand: selectedBrand,
        })
          .then((data) => (data.detail ? null : data.created_at || null))
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([fetchHealth, fetchLastScore, fetchLastSummary]).then(
      ([apiResult, lastScore, lastSummary]) => {
        const hasError = apiResult !== null && typeof apiResult === "object" && "error" in apiResult;
        setHealth({
          api: hasError
            ? null
            : (apiResult as { status: string; service: string }),
          apiError: hasError ? (apiResult as { error: string }).error : null,
          lastScoreDate: lastScore as string | null,
          lastSummaryDate: lastSummary as string | null,
        });
        setLoading(false);
      }
    );
  }, [selectedBrand, authedFetch]);

  if (brandLoading || loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <h1 className="text-heading tracking-tight text-charcoal">Data Health</h1>

      {health.apiError && <ErrorBanner message={health.apiError} />}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
          <p className="text-caption font-medium text-charcoal-muted">API Status</p>
          {health.api ? (
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  health.api.status === "healthy"
                    ? "bg-positive-500"
                    : "bg-yellow-500"
                }`}
              />
              <span className="text-body-lg font-medium text-charcoal capitalize">
                {health.api.status}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-body-lg font-medium text-red-600">
              Unreachable
            </p>
          )}
          {health.api && (
            <p className="mt-1 text-caption text-charcoal-faint">
              Service: {health.api.service}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
          <p className="text-caption font-medium text-charcoal-muted">Last Score Date</p>
          <p className="mt-3 text-body-lg font-medium text-charcoal">
            {health.lastScoreDate || "No scores recorded"}
          </p>
        </div>

        <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
          <p className="text-caption font-medium text-charcoal-muted">
            Last Weekly Summary
          </p>
          <p className="mt-3 text-body-lg font-medium text-charcoal">
            {health.lastSummaryDate
              ? new Date(health.lastSummaryDate).toLocaleString()
              : "No summary generated"}
          </p>
        </div>
      </div>
    </div>
  );
}
