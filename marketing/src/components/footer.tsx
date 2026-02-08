export function Footer() {
  return (
    <footer className="bg-white">
      <div className="section-container py-16 sm:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-6 h-6 rounded-md bg-primary-700 flex items-center justify-center">
                <span className="text-white font-bold text-[10px]">K</span>
              </div>
              <span className="text-sm font-semibold text-charcoal tracking-tight">
                KnewSearch
              </span>
            </a>
            <p className="text-body-sm text-charcoal-faint max-w-xs">
              AI search visibility analytics for brands that need to understand
              how they appear in AI-generated answers.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-caption font-semibold text-charcoal mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {[
                "Visibility Index",
                "Citation Coverage",
                "Volatility Alerts",
                "Weekly Briefs",
              ].map((item) => (
                <li key={item}>
                  <a
                    href="#product"
                    className="text-body-sm text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-caption font-semibold text-charcoal mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Documentation", href: "#resources" },
                { label: "API Reference", href: "#resources" },
                { label: "Blog", href: "/blog" },
                { label: "Changelog", href: "#resources" },
              ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-body-sm text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-caption font-semibold text-charcoal mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-body-sm text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200">About</a></li>
              <li><a href="mailto:hello@knewsearch.com" className="text-body-sm text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200">Contact</a></li>
              <li><a href="/privacy" className="text-body-sm text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200">Privacy Policy</a></li>
              <li><a href="/terms" className="text-body-sm text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-8 border-t border-surface-200/60 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-caption text-charcoal-faint">
            &copy; {new Date().getFullYear()} KnewSearch. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="/privacy"
              className="text-caption text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-caption text-charcoal-faint hover:text-charcoal-muted transition-colors duration-200"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
