import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Terms of Service | KnewSearch",
  description: "KnewSearch Terms of Service governing the use of our AI search visibility analytics platform.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="section-padding bg-white">
        <div className="section-container">
          <div className="max-w-3xl mx-auto prose prose-charcoal">
            <h1 className="text-heading-lg sm:text-display-sm text-charcoal mb-4">
              Terms of Service
            </h1>
            <p className="text-caption text-charcoal-faint mb-10">
              Last updated: February 2026
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              By accessing or using the KnewSearch platform ("Service"), you
              agree to be bound by these Terms of Service ("Terms"). If you do
              not agree to these Terms, you may not use the Service. The Service
              is operated by Hendricks.AI LLC ("Company", "we", "us").
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              2. Description of Service
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              KnewSearch provides AI search visibility analytics, including
              brand visibility scoring, citation tracking, volatility
              monitoring, and executive reporting across AI-generated search
              platforms. The Service is provided on a subscription basis.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              3. Account Registration
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              To use the Service, you must create an account and provide
              accurate, complete information. You are responsible for
              maintaining the confidentiality of your account credentials and
              for all activities that occur under your account.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              4. Subscription and Billing
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              Access to the Service requires a paid subscription. Subscriptions
              are billed on a recurring monthly basis through our payment
              processor, Stripe. You authorize us to charge your payment method
              for the applicable subscription fees. You may cancel your
              subscription at any time through the billing portal; cancellation
              takes effect at the end of the current billing period.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              5. Acceptable Use
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              You agree not to: (a) use the Service for any unlawful purpose;
              (b) attempt to gain unauthorized access to the Service or its
              systems; (c) interfere with or disrupt the Service; (d) resell,
              redistribute, or sublicense the Service without our prior written
              consent; (e) use automated tools to scrape or extract data from
              the Service beyond the provided API.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              6. Intellectual Property
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              The Service, including its design, code, algorithms, and content,
              is owned by Hendricks.AI LLC and protected by intellectual
              property laws. Your subscription grants you a limited,
              non-exclusive, non-transferable license to use the Service for
              your internal business purposes.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              7. Data and Privacy
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              Your use of the Service is also governed by our{" "}
              <a href="/privacy" className="text-primary-600 hover:text-primary-700">
                Privacy Policy
              </a>
              . You retain ownership of your data. We use your data solely to
              provide and improve the Service.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              8. Limitation of Liability
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              To the maximum extent permitted by law, Hendricks.AI LLC shall
              not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising out of or relating to
              your use of the Service. Our total liability shall not exceed the
              amount paid by you for the Service in the twelve months preceding
              the claim.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              9. Disclaimer of Warranties
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              The Service is provided "as is" and "as available" without
              warranties of any kind, either express or implied. We do not
              guarantee that the Service will be uninterrupted, error-free, or
              that AI search visibility scores will achieve any particular
              outcome.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              10. Termination
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              We may suspend or terminate your access to the Service at any
              time for violation of these Terms or non-payment. Upon
              termination, your right to use the Service ceases immediately.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              11. Changes to Terms
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              We may update these Terms from time to time. We will notify you
              of material changes via email or through the Service. Continued
              use of the Service after changes constitute acceptance of the
              updated Terms.
            </p>

            <h2 className="text-heading-sm text-charcoal mt-10 mb-4">
              12. Contact
            </h2>
            <p className="text-body text-charcoal-light mb-4">
              For questions about these Terms, contact us at{" "}
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
