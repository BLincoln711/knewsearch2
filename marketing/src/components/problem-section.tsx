import { EyeOff, BarChart3, SearchX } from "lucide-react";

const problems = [
  {
    icon: EyeOff,
    title: "AI answers reduce clicks",
    description:
      "Users get answers directly from AI. Your website traffic from search is declining, and traditional analytics cannot tell you why.",
  },
  {
    icon: BarChart3,
    title: "Visibility is no longer rankings",
    description:
      "In AI search, visibility means mentions and citations inside generated responses. Rank tracking tools were not designed for this.",
  },
  {
    icon: SearchX,
    title: "No analytics for AI search",
    description:
      "Teams have no way to measure whether their brand appears in ChatGPT, Gemini, or Perplexity answers. The data gap is growing.",
  },
];

export function ProblemSection() {
  return (
    <section className="section-padding bg-surface-50">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            The problem
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            Traditional SEO can&apos;t measure AI search
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10 lg:gap-14 max-w-5xl mx-auto">
          {problems.map((problem) => (
            <div key={problem.title} className="group text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 group-hover:bg-primary-100 mb-5 transition-colors duration-300">
                <problem.icon className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-heading-sm text-charcoal mb-3">
                {problem.title}
              </h3>
              <p className="text-body text-charcoal-muted">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
