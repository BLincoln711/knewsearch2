"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
  { label: "Blog", href: "/blog" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sectionIds = navLinks.map((l) => l.href.replace("#", ""));

    const handleScroll = () => {
      setScrolled(window.scrollY > 16);

      const scrollY = window.scrollY + 120;
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollY) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "glass-surface shadow-subtle"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="section-container flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary-700 flex items-center justify-center">
            <span className="text-white font-bold text-xs">K</span>
          </div>
          <span className="text-base font-semibold text-charcoal tracking-tight">
            KnewSearch
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = activeSection === link.href.replace("#", "");
            return (
              <a
                key={link.href}
                href={link.href}
                className={`text-body-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-charcoal"
                    : "text-charcoal-muted hover:text-charcoal"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="block h-px bg-primary-600 mt-0.5 rounded-full" />
                )}
              </a>
            );
          })}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="https://app.knewsearch.com"
            className="text-body-sm font-medium text-charcoal-muted hover:text-charcoal transition-colors duration-200"
          >
            Sign In
          </a>
          <a
            href="https://app.knewsearch.com/sign-up"
            className="inline-flex items-center justify-center px-4 py-2 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-lg transition-colors duration-200"
          >
            Start Free Trial
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-charcoal-muted hover:text-charcoal"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/98 backdrop-blur-xl">
          <div className="section-container py-4 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href.replace("#", "");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-body font-medium py-3 transition-colors ${
                    isActive
                      ? "text-charcoal"
                      : "text-charcoal-muted hover:text-charcoal"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
            <div className="h-px bg-surface-200/80 my-2" />
            <a
              href="https://app.knewsearch.com"
              className="text-body font-medium text-charcoal-muted hover:text-charcoal py-3 transition-colors"
            >
              Sign In
            </a>
            <a
              href="https://app.knewsearch.com/sign-up"
              className="inline-flex items-center justify-center mt-2 px-4 py-3 text-body font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-lg transition-colors"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
