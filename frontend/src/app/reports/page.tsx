"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { WeeklySummaryResponse } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Calendar, FileText } from "lucide-react";

export default function ReportsPage() {
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
        if (
          msg.includes("404") ||
          msg.includes("422") ||
          msg.includes("No weekly summary")
        ) {
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
        <div>
          <h1 className="text-heading tracking-tight text-charcoal">
            Reports
          </h1>
          <p className="mt-1 text-body-sm text-charcoal-muted">
            Weekly visibility reports with wins, losses, and recommendations.
          </p>
        </div>
        <EmptyState
          title="No reports yet"
          message="Your first weekly report will be generated automatically after your brand has been tracked for a full week."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading tracking-tight text-charcoal">Reports</h1>
        <p className="mt-1 text-body-sm text-charcoal-muted">
          Weekly visibility reports with wins, losses, and recommendations.
        </p>
      </div>

      {/* Report metadata */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface-0 p-5 shadow-card flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="text-caption font-medium text-charcoal-muted">
              Report Period
            </p>
            <p className="text-body-sm font-medium text-charcoal">
              {summary.week_start_date} &mdash; {summary.week_end_date}
            </p>
          </div>
        </div>
        <div className="rounded-2xl bg-surface-0 p-5 shadow-card flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="text-caption font-medium text-charcoal-muted">
              Generated
            </p>
            <p className="text-body-sm font-medium text-charcoal">
              {new Date(summary.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Report content */}
      <div className="rounded-2xl bg-surface-0 p-8 shadow-card">
        <h2 className="mb-6 text-body-lg font-semibold text-charcoal">
          Executive Summary
        </h2>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-charcoal-light leading-relaxed">
          {summary.email_ready_text}
        </div>
      </div>
    </div>
  );
}
