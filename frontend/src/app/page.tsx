"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useBrand } from "@/components/brand-context";
import { OverviewResponse, OverviewDay } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { VisibilityScore } from "@/components/visibility-score";
import { CompetitorBars } from "@/components/competitor-bars";
import { PlatformPills } from "@/components/platform-pills";
import { useRouter } from "next/navigation";

// Derive KPIs from time-series data
function deriveKpis(data: OverviewDay[]) {
  if (data.length === 0) return null;
  const latest = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const delta = prev ? latest.average_score - prev.average_score : 0;
  const avg =
    data.reduce((sum, d) => sum + d.average_score, 0) / data.length;
  return {
    currentScore: latest.average_score,
    delta,
    avg7d: avg,
    queriesTracked: latest.prompt_count,
  };
}

export default function VisibilityPage() {
  const { selectedBrand, brands, loading: brandLoading } = useBrand();
  const authedFetch = useAuthedFetch();
  const router = useRouter();

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

  // If no brands, redirect to onboarding
  useEffect(() => {
    if (!brandLoading && brands.length === 0) {
      router.push("/onboarding");
    }
  }, [brandLoading, brands, router]);

  if (brandLoading || loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  // No data yet — show getting-started state
  if (data.length === 0) {
    return (
      <div className="space-y-8">
        <h1 className="text-heading tracking-tight text-charcoal">
          Visibility
        </h1>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-0 py-20 px-6 text-center shadow-soft">
          <div className="h-16 w-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
              />
            </svg>
          </div>
          <p className="text-body-lg font-semibold text-charcoal">
            Your first scan is running
          </p>
          <p className="mt-2 text-body-sm text-charcoal-muted max-w-md">
            We&apos;re scanning AI search engines for your brand. Results
            usually appear within a few hours after your first pipeline run.
          </p>
        </div>
      </div>
    );
  }

  const kpis = deriveKpis(data);

  // Mock competitor data — replace with real API data when available
  const competitorData = [
    { name: selectedBrand, score: kpis?.currentScore ?? 0, isYou: true },
    { name: "Competitor A", score: Math.max(0, (kpis?.currentScore ?? 50) - 12) },
    { name: "Competitor B", score: Math.max(0, (kpis?.currentScore ?? 50) + 8) },
    { name: "Competitor C", score: Math.max(0, (kpis?.currentScore ?? 50) - 25) },
  ];

  // Mock platform data — replace with real API data when available
  const platforms = [
    { name: "ChatGPT", mentioned: true },
    { name: "Gemini", mentioned: true },
    { name: "Perplexity", mentioned: false },
    { name: "Google AI", mentioned: true },
    { name: "Copilot", mentioned: false },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-heading tracking-tight text-charcoal">
        Visibility
      </h1>

      {/* Top section: Score + KPIs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Big score */}
        <div className="rounded-2xl bg-surface-0 p-8 shadow-card flex flex-col items-center justify-center">
          {kpis && (
            <VisibilityScore
              score={kpis.currentScore}
              delta={kpis.delta}
            />
          )}
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
            <p className="text-caption font-medium text-charcoal-muted">
              7-Day Average
            </p>
            <p className="mt-2 text-heading-sm tracking-tight text-charcoal tabular-nums">
              {kpis?.avg7d.toFixed(1) ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
            <p className="text-caption font-medium text-charcoal-muted">
              Queries Tracked
            </p>
            <p className="mt-2 text-heading-sm tracking-tight text-charcoal tabular-nums">
              {kpis?.queriesTracked ?? "—"}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl bg-surface-0 p-6 shadow-card">
            <p className="text-caption font-medium text-charcoal-muted mb-3">
              Where you appear
            </p>
            <PlatformPills platforms={platforms} />
          </div>
        </div>
      </div>

      {/* Score trend chart */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
        <h2 className="mb-6 text-body font-semibold text-charcoal">
          Visibility Over Time
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="event_date"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              stroke="#e5e7eb"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
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
                boxShadow:
                  "0 8px 16px -4px rgb(0 0 0 / 0.07), 0 2px 6px -2px rgb(0 0 0 / 0.04)",
                backgroundColor: "#ffffff",
                padding: "10px 14px",
              }}
              labelStyle={{ color: "#6b7280", fontWeight: 500, marginBottom: 4 }}
              itemStyle={{ color: "#1a1a2e" }}
            />
            <Area
              type="monotone"
              dataKey="average_score"
              name="Visibility Score"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#scoreGrad)"
              dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: "#6366f1",
                strokeWidth: 2,
                stroke: "#ffffff",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Competitor comparison */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
        <h2 className="mb-6 text-body font-semibold text-charcoal">
          You vs. Competitors
        </h2>
        <CompetitorBars data={competitorData} />
      </div>
    </div>
  );
}
