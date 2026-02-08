"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Trend = "up" | "down" | "neutral";

const metrics: {
  label: string;
  value: string;
  delta: string;
  deltaLabel: string;
  hint: string;
  trend: Trend;
}[] = [
  {
    label: "Visibility Score",
    value: "72.4",
    delta: "+3.1",
    deltaLabel: "vs last week",
    hint: "How prominently your brand appears across all AI platforms, scored 0 to 100.",
    trend: "up",
  },
  {
    label: "7-Day Average",
    value: "68.9",
    delta: "+1.8",
    deltaLabel: "vs prior period",
    hint: "Smooths daily fluctuations so you can see the real trajectory.",
    trend: "up",
  },
  {
    label: "Prompts Scored",
    value: "1,247",
    delta: "+89",
    deltaLabel: "this week",
    hint: "Each prompt is a real AI search query where your brand could appear.",
    trend: "up",
  },
  {
    label: "Volatility",
    value: "Low",
    delta: "Stable",
    deltaLabel: "no change",
    hint: "Low volatility means AI platforms are returning consistent results for your brand.",
    trend: "neutral",
  },
];

const TrendIcon = ({ trend }: { trend: Trend }) => {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
};

export function MetricsPreview() {
  return (
    <section className="py-16 sm:py-20 bg-white relative">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            Live metrics
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            AI search visibility at a glance
          </h2>
          <p className="mt-4 text-body text-charcoal-muted max-w-xl mx-auto">
            Four numbers that tell your leadership team exactly where your brand
            stands in AI search today.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="group bg-white rounded-2xl p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300"
            >
              <p className="text-caption text-charcoal-faint font-medium uppercase tracking-wide">
                {metric.label}
              </p>
              <p className="text-display-sm sm:text-display text-charcoal mt-2 tracking-tight">
                {metric.value}
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-body-sm font-semibold ${
                    metric.trend === "up"
                      ? "text-positive-600"
                      : metric.trend === "down"
                      ? "text-red-500"
                      : "text-charcoal-faint"
                  }`}
                >
                  <TrendIcon trend={metric.trend} />
                  {metric.delta}
                </span>
                <span className="text-xs text-charcoal-faint">
                  {metric.deltaLabel}
                </span>
              </div>
              <p className="mt-3 pt-3 border-t border-surface-100 text-xs text-charcoal-muted leading-relaxed">
                {metric.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
