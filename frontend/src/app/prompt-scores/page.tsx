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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Prompt Scores</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-100 text-xs text-gray-400">
            {total} prompts scored
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Prompt ID</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-center">Brand Mentioned</th>
                <th className="px-4 py-3 text-right">Citations</th>
                <th className="px-4 py-3 text-right">Volatility Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {scores.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">
                    {row.prompt_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-900">
                    {row.score.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {row.brand_mentioned ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-700">
                    {row.citation_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-700">
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
