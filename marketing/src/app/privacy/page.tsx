import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy Policy | KnewSearch",
  description: "KnewSearch Privacy Policy describing how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="section-padding bg-white">
        <div className="section-container">
          <div className="max-w-3xl mx-auto prose prose-charcoal">
            <h1 className="text-heading-lg sm:text-display-sm text-charcoal mb-4">
              Privacy Policy
            </h1>
            <p className="text-caption text-charcoal-faint mb-10">
              Last updated: February 2026
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              1. Introduction
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              Hendricks.AI LLC ("Company", "we", "us") operates the KnewSearch
              platform ("Service"). This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you
              use our Service.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              2. Information We Collect
            </h2>
            <p className="text-body text-charcoal-light mb-2">
              We collect the following types of information:
            </p>
            <ul className="list-disc pl-6 text-body text-charcoal-light mb-4 space-y-1">
              <li>
                <strong>Account Information:</strong> Name, email address, and
                organization name provided during registration.
              </li>
              <li>
                <strong>Usage Data:</strong> Pages visited, features used,
                timestamps, and interactions with the dashboard.
              </li>
              <li>
                <strong>Brand Configuration Data:</strong> Brand names,
                monitoring prompts, and search categories you configure.
              </li>
              <li>
                <strong>Billing Information:</strong> Payment details are
                processed and stored by our payment processor, Stripe. We do
                not store full credit card numbers.
              </li>
            </ul>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 text-body text-charcoal-light mb-4 space-y-1">
              <li>To provide, operate, and maintain the Service</li>
              <li>To generate AI search visibility reports and analytics</li>
              <li>To send weekly summary emails and alerts</li>
              <li>To process subscription payments</li>
              <li>To respond to support requests and communicate with you</li>
              <li>To improve and develop the Service</li>
            </ul>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              4. Data Storage and Security
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              Your data is stored on Google Cloud Platform infrastructure in
              the United States. We implement appropriate technical and
              organizational measures to protect your data, including
              encryption in transit (TLS) and at rest, access controls, and
              regular security assessments.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              5. Data Sharing
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              We do not sell your personal information. We may share your data
              with:
            </p>
            <ul className="list-disc pl-6 text-body text-charcoal-light mb-4 space-y-1">
              <li>
                <strong>Service Providers:</strong> Google Cloud (hosting and
                analytics), Stripe (payments), SendGrid (email delivery), and
                Sentry (error monitoring) to operate the Service.
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law,
                subpoena, or legal process.
              </li>
            </ul>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              6. AI Search Data
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              The Service queries public AI search platforms (such as Google
              Gemini, ChatGPT, and Perplexity) to measure brand visibility.
              The responses from these platforms are publicly available
              information. We store and analyze these responses to generate
              your visibility scores and reports.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              7. Cookies and Tracking
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              We use essential cookies for authentication and session
              management. We do not use third-party advertising cookies or
              tracking pixels.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              8. Your Rights
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              You have the right to: (a) access your personal data; (b)
              request correction of inaccurate data; (c) request deletion of
              your data; (d) export your data; (e) withdraw consent for
              optional processing. To exercise these rights, contact us at{" "}
              <a
                href="mailto:hello@knewsearch.com"
                className="text-primary-600 hover:text-primary-700"
              >
                hello@knewsearch.com
              </a>
              .
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              9. Data Retention
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              We retain your account data for as long as your account is
              active. Visibility scores and analytics data are retained for up
              to 24 months. Upon account deletion, we will remove your
              personal data within 30 days, though anonymized analytics may
              be retained.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              10. Children&apos;s Privacy
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              The Service is not intended for individuals under 18 years of
              age. We do not knowingly collect personal information from
              children.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              11. Changes to This Policy
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              We may update this Privacy Policy from time to time. We will
              notify you of material changes via email or through the Service.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              12. Contact
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              For questions about this Privacy Policy, contact us at{" "}
              <a
                href="mailto:hello@knewsearch.com"
                className="text-primary-600 hover:text-primary-700"
              >
                hello@knewsearch.com
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
