"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { apiFetch, WeeklySummaryResponse } from "@/lib/api";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";

export default function WeeklySummaryPage() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const [summary, setSummary] = useState<WeeklySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setSummary(null);

    apiFetch<WeeklySummaryResponse | { detail: string }>("/weekly-summary", {
      brand: selectedBrand,
    })
      .then((data) => {
        if ("detail" in data) {
          setNotFound(true);
        } else {
          setSummary(data);
        }
      })
      .catch((err) => {
        const msg: string = err.message || "";
        if (msg.includes("404") || msg.includes("422") || msg.includes("No weekly summary")) {
          setNotFound(true);
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedBrand]);

  if (brandLoading || loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  if (notFound || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Weekly Summary</h1>
        <EmptyState
          title="No weekly summary available"
          message="The weekly summary has not been generated yet. It runs automatically on a weekly schedule."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Weekly Summary</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Week Start</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {summary.week_start_date}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Week End</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {summary.week_end_date}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Generated</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {new Date(summary.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Executive Summary
        </h2>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700 leading-relaxed">
          {summary.email_ready_text}
        </div>
      </div>
    </div>
  );
}
