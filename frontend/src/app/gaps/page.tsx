"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { PromptScoresResponse, PromptScore } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";

type GapType = "all" | "missing" | "visible";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function GapsPage() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const authedFetch = useAuthedFetch();

  const [scores, setScores] = useState<PromptScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GapType>("missing");

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    setError(null);
    authedFetch<PromptScoresResponse>("/prompt-scores", {
      brand: selectedBrand,
      date: todayStr(),
    })
      .then((res) => setScores(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedBrand, authedFetch]);

  if (brandLoading || loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  // Derive gaps: queries where brand is NOT mentioned
  const gaps = scores.filter((s) => !s.brand_mentioned);
  const visible = scores.filter((s) => s.brand_mentioned);

  const filtered =
    filter === "missing" ? gaps : filter === "visible" ? visible : scores;

  const gapCount = gaps.length;
  const visibleCount = visible.length;
  const total = scores.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading tracking-tight text-charcoal">Gaps</h1>
        <p className="mt-1 text-body-sm text-charcoal-muted">
          Search queries where you&apos;re missing from AI answers — and where
          you already show up.
        </p>
      </div>

      {scores.length === 0 ? (
        <EmptyState
          title="No visibility data yet"
          message="Once your first scan completes, you'll see which AI searches mention your brand and where you're missing."
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-red-50 p-5 shadow-subtle">
              <div className="flex items-center gap-2 mb-2">
                <EyeOff className="h-4 w-4 text-red-500" />
                <p className="text-caption font-medium text-red-700">
                  Not Showing Up
                </p>
              </div>
              <p className="text-heading-sm font-bold text-red-700 tabular-nums">
                {gapCount}
              </p>
              <p className="text-caption text-red-600/70">
                of {total} queries
              </p>
            </div>
            <div className="rounded-2xl bg-positive-50 p-5 shadow-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-positive-600" />
                <p className="text-caption font-medium text-positive-700">
                  Showing Up
                </p>
              </div>
              <p className="text-heading-sm font-bold text-positive-700 tabular-nums">
                {visibleCount}
              </p>
              <p className="text-caption text-positive-600/70">
                of {total} queries
              </p>
            </div>
            <div className="rounded-2xl bg-surface-0 p-5 shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-caption font-medium text-charcoal-muted">
                  Coverage Rate
                </p>
              </div>
              <p className="text-heading-sm font-bold text-charcoal tabular-nums">
                {total > 0 ? ((visibleCount / total) * 100).toFixed(0) : 0}%
              </p>
              <p className="text-caption text-charcoal-faint">
                of AI searches mention you
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {[
              { key: "missing" as GapType, label: `Not Showing Up (${gapCount})` },
              { key: "visible" as GapType, label: `Showing Up (${visibleCount})` },
              { key: "all" as GapType, label: `All (${total})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-body-sm rounded-lg transition-colors ${
                  filter === tab.key
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-charcoal-muted hover:text-charcoal hover:bg-surface-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Query table */}
          {filtered.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-surface-0 shadow-card">
              <table className="min-w-full divide-y divide-surface-100">
                <thead>
                  <tr className="bg-surface-50 text-left text-caption font-medium uppercase tracking-wider text-charcoal-muted">
                    <th className="px-6 py-3">Search Query</th>
                    <th className="px-6 py-3 text-center">Mentioned</th>
                    <th className="px-6 py-3 text-right">Citations</th>
                    <th className="px-6 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filtered.map((row) => (
                    <tr
                      key={row.prompt_id}
                      className="hover:bg-surface-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-body-sm text-charcoal-light max-w-lg">
                        <span className="line-clamp-2">
                          {row.prompt_id.replace(/_/g, " ").replace(/^prm /, "")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.brand_mentioned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-positive-50 px-2 py-0.5 text-caption font-medium text-positive-700">
                            <Eye className="h-3 w-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-caption font-medium text-red-600">
                            <EyeOff className="h-3 w-3" />
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-body-sm text-right tabular-nums text-charcoal-light">
                        {row.citation_count}
                      </td>
                      <td className="px-6 py-4 text-body-sm text-right tabular-nums font-medium text-charcoal">
                        {row.score.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-body-sm text-charcoal-muted">
              No queries match this filter.
            </div>
          )}
        </>
      )}
    </div>
  );
}
