import { BarChart3, FileText, List } from "lucide-react";

const screens = [
  {
    icon: BarChart3,
    label: "Dashboard Overview",
    sublabel: "Real-time visibility metrics and trends",
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "Score", v: "72.4" },
            { l: "Avg", v: "68.9" },
            { l: "Scored", v: "1.2K" },
          ].map((m) => (
            <div key={m.l} className="bg-surface-50 rounded-lg p-2.5">
              <p className="text-[10px] text-charcoal-faint">{m.l}</p>
              <p className="text-sm font-bold text-charcoal">{m.v}</p>
            </div>
          ))}
        </div>
        <div className="bg-surface-50 rounded-lg p-3">
          <svg
            viewBox="0 0 200 60"
            className="w-full h-16"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="miniArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4338ca" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#4338ca" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {/* Subtle gridlines */}
            <line x1="0" y1="20" x2="200" y2="20" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1="0" y1="40" x2="200" y2="40" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" />
            <path
              d="M0,45 C15,40 30,35 50,30 C70,25 90,32 110,24 C130,16 150,20 170,12 C185,8 200,6 200,6 L200,60 L0,60 Z"
              fill="url(#miniArea)"
            />
            <path
              d="M0,45 C15,40 30,35 50,30 C70,25 90,32 110,24 C130,16 150,20 170,12 C185,8 200,6 200,6"
              fill="none"
              stroke="#4338ca"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="200" cy="6" r="2" fill="#4338ca" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    icon: FileText,
    label: "Weekly Summary",
    sublabel: "Executive-ready reports delivered every Monday",
    content: (
      <div className="space-y-3">
        <div className="bg-surface-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-positive-400" />
            <p className="text-[10px] font-semibold text-charcoal-muted">
              Week of Jan 27, 2026
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 bg-surface-200 rounded w-full" />
            <div className="h-2 bg-surface-200 rounded w-11/12" />
            <div className="h-2 bg-surface-200 rounded w-4/5" />
          </div>
        </div>
        <div className="bg-surface-50 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-charcoal-faint mb-2">
            Key Insights
          </p>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded bg-primary-50 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="h-1.5 bg-surface-200 rounded w-full" />
                  <div className="h-1.5 bg-surface-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: List,
    label: "Prompt Scores",
    sublabel: "Granular scoring data for every monitored prompt",
    content: (
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-2 px-2">
          {["Prompt", "Score", "Cited", "Vol"].map((h) => (
            <p
              key={h}
              className="text-[9px] font-semibold text-charcoal-faint uppercase"
            >
              {h}
            </p>
          ))}
        </div>
        {[
          { score: 85, cited: true, vol: "Low" },
          { score: 72, cited: true, vol: "Med" },
          { score: 64, cited: false, vol: "Low" },
          { score: 91, cited: true, vol: "Low" },
          { score: 45, cited: false, vol: "High" },
        ].map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-2 px-2 py-1.5 rounded-lg bg-surface-50 items-center"
          >
            <div className="h-2 bg-surface-200 rounded w-full" />
            <p className="text-xs font-semibold text-charcoal-light">
              {row.score}
            </p>
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                row.cited ? "bg-positive-100" : "bg-surface-100"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  row.cited ? "bg-positive-500" : "bg-surface-300"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-medium ${
                row.vol === "High"
                  ? "text-red-400"
                  : row.vol === "Med"
                  ? "text-amber-400"
                  : "text-positive-500"
              }`}
            >
              {row.vol}
            </span>
          </div>
        ))}
      </div>
    ),
  },
];

export function ProductPreview() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            Platform preview
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            Inside the KnewSearch platform
          </h2>
          <p className="mt-4 text-body-lg text-charcoal-muted">
            Three views that give your team complete visibility into how your
            brand performs across AI search.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {screens.map((screen) => (
            <div
              key={screen.label}
              className="group bg-surface-50 rounded-2xl overflow-hidden shadow-soft hover:shadow-card transition-shadow duration-300"
            >
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors duration-300">
                    <screen.icon className="w-4 h-4 text-primary-600" />
                  </div>
                  <h3 className="text-body font-semibold text-charcoal">
                    {screen.label}
                  </h3>
                </div>
                <p className="text-caption text-charcoal-faint">
                  {screen.sublabel}
                </p>
              </div>
              <div className="px-4 pb-4">{screen.content}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
