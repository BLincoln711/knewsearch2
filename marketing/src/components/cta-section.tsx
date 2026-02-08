import { ArrowRight, CalendarDays } from "lucide-react";

export function CtaSection() {
  return (
    <section id="request-access" className="section-padding bg-surface-50">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-700 mb-8">
            <span className="text-white font-bold text-lg">K</span>
          </div>

          <h2 className="text-heading-lg sm:text-display-sm lg:text-display text-charcoal">
            Start measuring your AI search visibility
          </h2>
          <p className="mt-5 text-body-lg text-charcoal-muted max-w-xl mx-auto">
            Join the brands that already understand how they appear in
            AI-generated search answers. Early access is limited.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="https://app.knewsearch.com/sign-up"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 text-body font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="mailto:hello@knewsearch.com?subject=Book%20a%20Demo"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 text-body font-medium text-charcoal-light bg-white hover:bg-surface-100 shadow-soft rounded-xl transition-all duration-200"
            >
              <CalendarDays className="w-4 h-4" />
              Book a Demo
            </a>
          </div>

          <p className="mt-6 text-caption text-charcoal-faint">
            No credit card required. Setup in under 24 hours.
          </p>
        </div>
      </div>
    </section>
  );
}
