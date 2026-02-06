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
  Area,
  AreaChart,
} from "recharts";
import { useBrand } from "@/components/brand-context";
import { OverviewResponse, OverviewDay } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { KpiTile } from "@/components/kpi-tile";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";

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
  const authedFetch = useAuthedFetch();
  const [data, setData] = useState<OverviewDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBrand) return;
    setLoading(true);
    setError(null);
    authedFetch<OverviewResponse>("/overview", { brand: selectedBrand })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedBrand, authedFetch]);

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
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-heading tracking-tight text-charcoal">Overview</h1>
        {selectedBrand && (
          <ExportButton
            path="/overview"
            params={{ brand: selectedBrand }}
            filename={`${selectedBrand}_overview.csv`}
          />
        )}
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <KpiTile label="Latest Score" value={kpis.latestScore} />
          <KpiTile label="7 Day Average" value={kpis.avg7d} />
          <KpiTile label="Prompt Count" value={kpis.promptCount} />
          <KpiTile label="Volatility" value={kpis.volatility} />
        </div>
      )}

      <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
        <h2 className="mb-6 text-body font-semibold text-charcoal">
          Average Score Over Time
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
            <XAxis
              dataKey="event_date"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              stroke="#e5e7eb"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              stroke="#e5e7eb"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 13,
                borderRadius: 12,
                border: "none",
                boxShadow: "0 8px 16px -4px rgb(0 0 0 / 0.07), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
                backgroundColor: "#ffffff",
                padding: "10px 14px",
              }}
              labelStyle={{ color: "#6b7280", fontWeight: 500, marginBottom: 4 }}
              itemStyle={{ color: "#1a1a2e" }}
            />
            <Area
              type="monotone"
              dataKey="average_score"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#ffffff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
