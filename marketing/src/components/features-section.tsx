import { Activity, Link2, AlertTriangle, FileText } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Visibility Index",
    description:
      "A single score that tells you how prominently your brand appears across AI search platforms, tracked daily.",
  },
  {
    icon: Link2,
    title: "Citation Coverage",
    description:
      "Track which of your pages are being cited as sources in AI answers and how often they appear.",
  },
  {
    icon: AlertTriangle,
    title: "Volatility Alerts",
    description:
      "Get notified when your visibility shifts significantly, so you can investigate and respond quickly.",
  },
  {
    icon: FileText,
    title: "Weekly Executive Briefs",
    description:
      "Concise summaries designed for leadership, highlighting key changes, trends, and recommended actions.",
  },
];

export function FeaturesSection() {
  return (
    <section className="section-padding bg-surface-50">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            What you get
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            Purpose-built analytics for AI search visibility
          </h2>
          <p className="mt-4 text-body-lg text-charcoal-muted">
            Everything your team needs to measure performance in the new search
            landscape.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-white rounded-2xl p-7 shadow-soft hover:shadow-card transition-shadow duration-300"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50 group-hover:bg-primary-100 mb-5 transition-colors duration-300">
                <feature.icon className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-body-lg font-semibold text-charcoal mb-2">
                {feature.title}
              </h3>
              <p className="text-body text-charcoal-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
