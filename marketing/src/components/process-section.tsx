import { Radar, FileSearch, TrendingUp, Send } from "lucide-react";

const steps = [
  {
    icon: Radar,
    step: "01",
    title: "Monitor AI answers",
    description:
      "We run targeted prompts across ChatGPT, Gemini, and Perplexity to capture real AI-generated responses in your category.",
  },
  {
    icon: FileSearch,
    step: "02",
    title: "Extract mentions and citations",
    description:
      "Every response is parsed for brand mentions, source citations, competitor references, and sentiment signals.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "Score visibility",
    description:
      "Your brand receives a composite visibility score based on mention frequency, citation quality, and answer positioning.",
  },
  {
    icon: Send,
    step: "04",
    title: "Deliver executive summaries",
    description:
      "Weekly reports translate raw data into clear insights your leadership team can act on immediately.",
  },
];

export function ProcessSection() {
  return (
    <section id="product" className="section-padding bg-white">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            How it works
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            From raw AI responses to actionable visibility data
          </h2>
          <p className="mt-4 text-body-lg text-charcoal-muted">
            KnewSearch automates the entire pipeline so your team can focus on
            strategy, not data collection.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step) => (
            <div
              key={step.step}
              className="group relative bg-surface-50 rounded-2xl p-6 hover:bg-white hover:shadow-card transition-all duration-300"
            >
              <span className="text-caption font-bold text-primary-400 mb-4 block">
                {step.step}
              </span>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 group-hover:bg-primary-100 mb-4 transition-colors duration-300">
                <step.icon className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-body-lg font-semibold text-charcoal mb-2">
                {step.title}
              </h3>
              <p className="text-body-sm text-charcoal-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
