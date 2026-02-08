import { Cloud, Database, Cpu, Shield } from "lucide-react";

const trustBadges = [
  {
    icon: Cloud,
    label: "Built on Google Cloud",
    description: "Enterprise-grade cloud infrastructure",
  },
  {
    icon: Database,
    label: "Powered by BigQuery",
    description: "Petabyte-scale analytics engine",
  },
  {
    icon: Cpu,
    label: "Gemini AI Processing",
    description: "Advanced language understanding",
  },
  {
    icon: Shield,
    label: "Production Grade",
    description: "SOC 2 ready infrastructure",
  },
];

export function ProofSection() {
  return (
    <section className="section-padding bg-primary-950">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-16">
          <p className="text-caption font-semibold text-primary-300 tracking-wide uppercase mb-3">
            Enterprise ready
          </p>
          <h2 className="text-heading-lg sm:text-display-sm font-bold text-white">
            Built on infrastructure you can trust
          </h2>
          <p className="mt-4 text-body-lg text-primary-200/60">
            KnewSearch runs on the same cloud platform trusted by the
            world&apos;s largest enterprises. Your data is secure, your
            analytics are reliable.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {trustBadges.map((badge) => (
            <div
              key={badge.label}
              className="group rounded-2xl p-6 text-center bg-white/[0.04] hover:bg-white/[0.07] transition-colors duration-300"
            >
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white/[0.06] group-hover:bg-white/[0.1] mb-4 transition-colors duration-300">
                <badge.icon className="w-5 h-5 text-primary-300" />
              </div>
              <h3 className="text-body font-semibold text-white mb-1">
                {badge.label}
              </h3>
              <p className="text-body-sm text-primary-200/50">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
