import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Connect your brand",
    description:
      "Tell us your brand name and category. We configure monitoring across ChatGPT, Gemini, and Perplexity within 24 hours.",
  },
  {
    number: "2",
    title: "We collect the data",
    description:
      "Our pipeline runs daily, scoring hundreds of AI-generated responses to track your brand visibility over time.",
  },
  {
    number: "3",
    title: "You get the insights",
    description:
      "Log in to your dashboard for real-time metrics, or read the weekly executive summary delivered to your inbox.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section-padding bg-surface-50">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            Getting started
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            Up and running in three simple steps
          </h2>
          <p className="mt-4 text-body-lg text-charcoal-muted">
            No integration required. No code to install. We handle the
            infrastructure so you can focus on results.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10 lg:gap-14">
            {steps.map((step, index) => (
              <div key={step.number} className="group relative text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-700 text-white font-bold text-lg mb-5">
                  {step.number}
                </div>

                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(50%+36px)] right-[calc(-50%+36px)]">
                    <div className="h-px bg-surface-300 w-full relative">
                      <ArrowRight className="w-3.5 h-3.5 text-surface-300 absolute -right-1.5 -top-1.5" />
                    </div>
                  </div>
                )}

                <h3 className="text-body-lg font-semibold text-charcoal mb-2">
                  {step.title}
                </h3>
                <p className="text-body text-charcoal-muted">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
