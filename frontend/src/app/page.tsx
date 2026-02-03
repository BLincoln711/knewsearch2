"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useBrand } from "@/components/brand-context";
import { apiFetch, OverviewResponse, OverviewDay } from "@/lib/api";
import { KpiTile } from "@/components/kpi-tile";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";

function computeKpis(data: OverviewDay[]) {
  if (data.length === 0) return null;

  const latest = data[data.length - 1];
  const scores = data.map((d) => d.average_score);
  const avg7d =
    scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const mean = avg7d;
  const variance =
    scores.length > 1
      ? scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
        (scores.length - 1)
      : 0;
  const volatility = Math.sqrt(variance);

  return {
    latestScore: latest.average_score.toFixed(1),
    avg7d: avg7d.toFixed(1),
    promptCount: latest.prompt_count,
    volatility: volatility.toFixed(2),
  };
}

export default function OverviewPage() {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const [data, setData] = useState<OverviewDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    setError(null);
    apiFetch<OverviewResponse>("/overview", { brand: selectedBrand })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedBrand]);

  if (brandLoading || loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  if (data.length === 0) {
    return (
      <EmptyState
        title="No visibility data yet"
        message="Run the scoring pipeline to generate your first visibility scores. Data will appear here once scoring completes."
      />
    );
  }

  const kpis = computeKpis(data);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Overview</h1>

      {kpis && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiTile label="Latest Score" value={kpis.latestScore} />
          <KpiTile label="7 Day Average" value={kpis.avg7d} />
          <KpiTile label="Prompt Count" value={kpis.promptCount} />
          <KpiTile label="Volatility" value={kpis.volatility} />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Average Score Over Time
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="event_date"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />
            <Line
              type="monotone"
              dataKey="average_score"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
