import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { MetricsPreview } from "@/components/metrics-preview";
import { ProblemSection } from "@/components/problem-section";
import { ProcessSection } from "@/components/process-section";
import { FeaturesSection } from "@/components/features-section";
import { ProductPreview } from "@/components/product-preview";
import { ProofSection } from "@/components/proof-section";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { PricingSection } from "@/components/pricing-section";
import { CtaSection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <MetricsPreview />
        <ProblemSection />
        <ProcessSection />
        <FeaturesSection />
        <ProductPreview />
        <ProofSection />
        <HowItWorksSection />
        <PricingSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
