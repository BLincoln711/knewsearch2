"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/components/brand-context";
import { apiFetch, PromptScoresResponse, PromptScore } from "@/lib/api";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PromptScoresPage() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const [date, setDate] = useState(todayStr);
  const [scores, setScores] = useState<PromptScore[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    setError(null);
    apiFetch<PromptScoresResponse>("/prompt-scores", {
      brand: selectedBrand,
      date,
    })
      .then((res) => {
        setScores(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedBrand, date]);

  if (brandLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-heading tracking-tight text-charcoal">Prompt Scores</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-1.5 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} />}

      {!loading && !error && scores.length === 0 && (
        <EmptyState
          title="No scores for this date"
          message="There are no prompt scores recorded for the selected date. Try a different date or run the scoring pipeline."
        />
      )}

      {!loading && !error && scores.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-surface-0 shadow-card">
          <div className="px-6 py-4 text-caption text-charcoal-muted">
            {total} prompts scored
          </div>
          <table className="min-w-full divide-y divide-surface-100">
            <thead>
              <tr className="bg-surface-50 text-left text-caption font-medium uppercase tracking-wider text-charcoal-muted">
                <th className="px-6 py-3">Prompt ID</th>
                <th className="px-6 py-3 text-right">Score</th>
                <th className="px-6 py-3 text-center">Brand Mentioned</th>
                <th className="px-6 py-3 text-right">Citations</th>
                <th className="px-6 py-3 text-right">Volatility Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {scores.map((row, i) => (
                <tr key={i} className="hover:bg-surface-50 transition-colors">
                  <td className="px-6 py-4 text-body-sm font-mono text-charcoal-light">
                    {row.prompt_id}
                  </td>
                  <td className="px-6 py-4 text-body-sm text-right tabular-nums text-charcoal font-medium">
                    {row.score.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-body-sm text-center">
                    {row.brand_mentioned ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-positive-500" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-surface-300" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-body-sm text-right tabular-nums text-charcoal-light">
                    {row.citation_count}
                  </td>
                  <td className="px-6 py-4 text-body-sm text-right tabular-nums text-charcoal-light">
                    {row.volatility_rank}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
