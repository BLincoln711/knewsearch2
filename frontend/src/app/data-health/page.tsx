"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { apiFetch, HealthResponse, OverviewResponse } from "@/lib/api";
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
  const [health, setHealth] = useState<HealthState>({
    api: null,
    lastScoreDate: null,
    lastSummaryDate: null,
    apiError: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const fetchHealth = apiFetch<HealthResponse>("/health")
      .then((res) => res)
      .catch((err) => ({ error: err.message }));

    const fetchLastScore = selectedBrand
      ? apiFetch<OverviewResponse>("/overview", { brand: selectedBrand })
          .then((res) =>
            res.data.length > 0
              ? res.data[res.data.length - 1].event_date
              : null
          )
          .catch(() => null)
      : Promise.resolve(null);

    const fetchLastSummary = selectedBrand
      ? apiFetch<{ created_at?: string; detail?: string }>("/weekly-summary", {
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
  }, [selectedBrand]);

  if (brandLoading || loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Data Health</h1>

      {health.apiError && <ErrorBanner message={health.apiError} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">API Status</p>
          {health.api ? (
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  health.api.status === "healthy"
                    ? "bg-green-500"
                    : "bg-yellow-500"
                }`}
              />
              <span className="text-lg font-medium text-gray-900 capitalize">
                {health.api.status}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-lg font-medium text-red-600">
              Unreachable
            </p>
          )}
          {health.api && (
            <p className="mt-1 text-xs text-gray-400">
              Service: {health.api.service}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Last Score Date</p>
          <p className="mt-2 text-lg font-medium text-gray-900">
            {health.lastScoreDate || "No scores recorded"}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">
            Last Weekly Summary
          </p>
          <p className="mt-2 text-lg font-medium text-gray-900">
            {health.lastSummaryDate
              ? new Date(health.lastSummaryDate).toLocaleString()
              : "No summary generated"}
          </p>
        </div>
      </div>
    </div>
  );
}
