import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pt-44 lg:pb-28">
      {/* Background gradient — nearly imperceptible */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/30 via-surface-50 to-surface-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary-100/20 rounded-full blur-[120px]" />
      </div>

      <div className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-8 rounded-full bg-white shadow-soft">
            <span className="w-1.5 h-1.5 rounded-full bg-positive-500" />
            <span className="text-caption font-medium text-charcoal-muted">
              Now monitoring AI search platforms
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-display-sm sm:text-display lg:text-display-lg text-charcoal">
            See how your brand appears in{" "}
            <span className="gradient-text">AI search answers</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-body-lg text-charcoal-muted max-w-2xl mx-auto">
            KnewSearch measures brand visibility, citations, and volatility
            across AI search experiences that traditional SEO was never designed
            to track.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="https://app.knewsearch.com/sign-up"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 text-body font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#product"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 text-body font-medium text-charcoal-light bg-white hover:bg-surface-100 shadow-soft rounded-xl transition-all duration-200"
            >
              <Play className="w-4 h-4" />
              View Example Report
            </a>
          </div>

          {/* Trust indicator */}
          <p className="mt-6 text-caption text-charcoal-faint">
            Built on Google Cloud. Used by enterprise marketing teams to monitor
            ChatGPT, Gemini, and Perplexity.
          </p>
        </div>

        {/* Product preview */}
        <div className="mt-16 sm:mt-20 max-w-5xl mx-auto">
          <div className="relative rounded-2xl sm:rounded-3xl shadow-elevated bg-white overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-surface-50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-surface-200" />
                <div className="w-2.5 h-2.5 rounded-full bg-surface-200" />
                <div className="w-2.5 h-2.5 rounded-full bg-surface-200" />
              </div>
              <div className="flex-1 mx-8">
                <div className="max-w-xs mx-auto h-6 rounded-md bg-surface-100 flex items-center justify-center">
                  <span className="text-xs text-charcoal-faint">
                    app.knewsearch.com
                  </span>
                </div>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="p-6 sm:p-8 bg-surface-50/50">
              {/* Top metrics row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Visibility Score", value: "72.4", delta: "+3.1" },
                  { label: "7 Day Average", value: "68.9", delta: "+1.8" },
                  { label: "Prompts Scored", value: "1,247", delta: "+89" },
                  { label: "Volatility", value: "Low", delta: "Stable" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="bg-white rounded-xl shadow-subtle p-4"
                  >
                    <p className="text-xs text-charcoal-faint font-medium">
                      {metric.label}
                    </p>
                    <p className="text-xl font-bold text-charcoal mt-1">
                      {metric.value}
                    </p>
                    <span className="text-xs font-medium text-positive-600">
                      {metric.delta}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chart area — area chart with gradient fill */}
              <div className="bg-white rounded-xl shadow-subtle p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-charcoal-light">
                    Visibility Trend
                  </p>
                  <div className="flex gap-1.5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-primary-50 text-primary-700 font-medium">
                      7D
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-md text-charcoal-faint">
                      30D
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-md text-charcoal-faint">
                      90D
                    </span>
                  </div>
                </div>
                {/* SVG area chart with subtle gridlines */}
                <svg
                  viewBox="0 0 400 120"
                  className="w-full h-36 sm:h-44"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="areaFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#4338ca"
                        stopOpacity="0.12"
                      />
                      <stop
                        offset="100%"
                        stopColor="#4338ca"
                        stopOpacity="0.01"
                      />
                    </linearGradient>
                  </defs>
                  {/* Subtle horizontal gridlines */}
                  {[30, 55, 80].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="400"
                      y2={y}
                      stroke="#e5e7eb"
                      strokeWidth="0.5"
                      strokeDasharray="4 4"
                    />
                  ))}
                  {/* Y-axis labels — secondary, not dominant */}
                  <text x="4" y="28" fill="#9ca3af" fontSize="7" fontFamily="Inter, sans-serif">80</text>
                  <text x="4" y="53" fill="#9ca3af" fontSize="7" fontFamily="Inter, sans-serif">60</text>
                  <text x="4" y="78" fill="#9ca3af" fontSize="7" fontFamily="Inter, sans-serif">40</text>
                  {/* Area fill */}
                  <path
                    d="M0,80 C20,75 40,70 60,65 C80,60 100,50 120,45 C140,40 160,48 180,42 C200,36 220,30 240,28 C260,26 280,32 300,25 C320,18 340,22 360,15 C380,12 400,10 400,10 L400,120 L0,120 Z"
                    fill="url(#areaFill)"
                  />
                  {/* Trend line */}
                  <path
                    d="M0,80 C20,75 40,70 60,65 C80,60 100,50 120,45 C140,40 160,48 180,42 C200,36 220,30 240,28 C260,26 280,32 300,25 C320,18 340,22 360,15 C380,12 400,10 400,10"
                    fill="none"
                    stroke="#4338ca"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  {/* End dot */}
                  <circle cx="400" cy="10" r="3" fill="#4338ca" />
                  <circle cx="400" cy="10" r="5" fill="#4338ca" fillOpacity="0.15" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
