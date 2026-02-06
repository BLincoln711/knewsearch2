"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { WeeklySummaryResponse } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";

export default function WeeklySummaryPage() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const authedFetch = useAuthedFetch();
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

    authedFetch<WeeklySummaryResponse | { detail: string }>("/weekly-summary", {
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
  }, [selectedBrand, authedFetch]);

  if (brandLoading || loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  if (notFound || !summary) {
    return (
      <div className="space-y-8">
        <h1 className="text-heading tracking-tight text-charcoal">Weekly Summary</h1>
        <EmptyState
          title="No weekly summary available"
          message="The weekly summary has not been generated yet. It runs automatically on a weekly schedule."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-heading tracking-tight text-charcoal">Weekly Summary</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
          <p className="text-caption font-medium text-charcoal-muted">Week Start</p>
          <p className="mt-2 text-body font-medium text-charcoal">
            {summary.week_start_date}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
          <p className="text-caption font-medium text-charcoal-muted">Week End</p>
          <p className="mt-2 text-body font-medium text-charcoal">
            {summary.week_end_date}
          </p>
        </div>
        <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
          <p className="text-caption font-medium text-charcoal-muted">Generated</p>
          <p className="mt-2 text-body font-medium text-charcoal">
            {new Date(summary.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-0 p-8 shadow-card">
        <h2 className="mb-6 text-body font-semibold text-charcoal">
          Executive Summary
        </h2>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-charcoal-light leading-relaxed">
          {summary.email_ready_text}
        </div>
      </div>
    </div>
  );
}
