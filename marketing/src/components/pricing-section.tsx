import { Check, ArrowRight } from "lucide-react";

const features = [
  "Daily AI search visibility scoring",
  "Brand mention and citation tracking",
  "Volatility monitoring and alerts",
  "Executive weekly summary reports",
  "Full dashboard access",
  "Email delivery of weekly briefs",
  "Multiple brand monitoring",
  "Priority support",
];

export function PricingSection() {
  return (
    <section id="pricing" className="section-padding bg-white">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-600 tracking-wide uppercase mb-3">
            Pricing
          </p>
          <h2 className="text-heading-lg sm:text-display-sm text-charcoal">
            Plans that scale with your needs
          </h2>
          <p className="mt-4 text-body-lg text-charcoal-muted">
            Start small and grow as your AI search monitoring needs evolve.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="relative rounded-2xl p-8 bg-white shadow-card hover:shadow-card-hover ring-1 ring-primary-200 transition-shadow duration-300">
            <h3 className="text-body-lg font-semibold text-charcoal">
              KnewSearch Visibility Dashboard
            </h3>
            <p className="mt-3 text-heading text-charcoal">
              Contact us for pricing
            </p>
            <p className="mt-2 text-body-sm text-charcoal-muted">
              Everything you need to measure and improve your brand&apos;s
              visibility in AI-generated search answers.
            </p>

            <a
              href="https://app.knewsearch.com/sign-up"
              className="mt-6 inline-flex items-center justify-center gap-2 w-full px-5 py-3 text-body-sm font-semibold rounded-xl text-white bg-primary-700 hover:bg-primary-800 transition-colors duration-200"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </a>

            <ul className="mt-6 space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-positive-600 mt-0.5 shrink-0" />
                  <span className="text-body-sm text-charcoal-muted">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
