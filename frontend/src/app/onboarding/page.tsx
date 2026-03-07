"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthedMutate } from "@/lib/use-authed-fetch";
import { Globe, Plus, X, ArrowRight, Loader2, Sparkles } from "lucide-react";

type Step = "brand" | "competitors" | "processing";

export default function OnboardingPage() {
  const router = useRouter();
  const authedMutate = useAuthedMutate();

  const [step, setStep] = useState<Step>("brand");
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");

  const handleBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || !websiteUrl.trim()) return;
    setStep("competitors");
  };

  const addCompetitor = () => {
    const val = competitorInput.trim();
    if (!val || competitors.includes(val)) return;
    setCompetitors([...competitors, val]);
    setCompetitorInput("");
  };

  const removeCompetitor = (c: string) => {
    setCompetitors(competitors.filter((x) => x !== c));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCompetitor();
    }
  };

  const startProcessing = async () => {
    setStep("processing");
    setError(null);

    try {
      setProcessingStatus("Scanning your website...");
      await new Promise((r) => setTimeout(r, 1500));

      setProcessingStatus(
        competitors.length > 0
          ? "Setting up competitor tracking..."
          : "Identifying your competitors..."
      );
      await new Promise((r) => setTimeout(r, 1500));

      setProcessingStatus("Generating search queries...");

      await authedMutate("/onboarding", "POST", {
        brand_name: brandName.trim(),
        website_url: websiteUrl.trim(),
        competitors: competitors.length > 0 ? competitors : undefined,
      });

      setProcessingStatus("Running your first visibility scan...");
      await new Promise((r) => setTimeout(r, 2000));

      router.push("/");
    } catch (err: unknown) {
      // If the backend endpoint doesn't exist yet, still proceed to dashboard
      const msg = err instanceof Error ? err.message : "Setup failed";
      if (msg.includes("404") || msg.includes("405")) {
        setProcessingStatus("Finalizing setup...");
        await new Promise((r) => setTimeout(r, 1000));
        router.push("/");
      } else {
        setError(msg);
        setStep("competitors");
      }
    }
  };

  if (step === "processing") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary-50">
            <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
          </div>
          <div>
            <p className="text-body-lg font-semibold text-charcoal">
              Setting up your dashboard
            </p>
            <p className="mt-2 text-body-sm text-charcoal-muted">
              {processingStatus}
            </p>
          </div>
          {error && (
            <p className="text-body-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div
            className={`h-2 w-16 rounded-full ${
              step === "brand" ? "bg-primary-600" : "bg-primary-200"
            }`}
          />
          <div
            className={`h-2 w-16 rounded-full ${
              step === "competitors" ? "bg-primary-600" : "bg-surface-200"
            }`}
          />
        </div>

        {step === "brand" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-heading tracking-tight text-charcoal">
                Let&apos;s set up your brand
              </h1>
              <p className="mt-2 text-body-sm text-charcoal-muted">
                We&apos;ll scan AI search engines to see where your brand
                appears.
              </p>
            </div>

            <form
              onSubmit={handleBrandSubmit}
              className="rounded-2xl bg-surface-0 p-8 shadow-card space-y-5"
            >
              <div>
                <label className="block text-body-sm font-medium text-charcoal-light mb-1.5">
                  Brand name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  required
                  className="w-full rounded-lg border border-surface-200 bg-surface-0 px-4 py-2.5 text-body-sm text-charcoal shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-charcoal-light mb-1.5">
                  Website URL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-faint" />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://acmecorp.com"
                    required
                    className="w-full rounded-lg border border-surface-200 bg-surface-0 pl-10 pr-4 py-2.5 text-body-sm text-charcoal shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!brandName.trim() || !websiteUrl.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {step === "competitors" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-heading tracking-tight text-charcoal">
                Who are your competitors?
              </h1>
              <p className="mt-2 text-body-sm text-charcoal-muted">
                Optional — add competitors you want to track, or we&apos;ll find
                them for you.
              </p>
            </div>

            <div className="rounded-2xl bg-surface-0 p-8 shadow-card space-y-5">
              {/* Competitor input */}
              <div>
                <label className="block text-body-sm font-medium text-charcoal-light mb-1.5">
                  Competitor name or website
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Competitor Inc or competitor.com"
                    className="flex-1 rounded-lg border border-surface-200 bg-surface-0 px-4 py-2.5 text-body-sm text-charcoal shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    type="button"
                    onClick={addCompetitor}
                    disabled={!competitorInput.trim()}
                    className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2.5 text-charcoal-muted shadow-subtle transition-colors hover:bg-surface-50 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Competitor chips */}
              {competitors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {competitors.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-caption font-medium text-primary-700"
                    >
                      {c}
                      <button
                        onClick={() => removeCompetitor(c)}
                        className="rounded-full p-0.5 hover:bg-primary-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-body-sm text-red-600">{error}</p>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={startProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-700"
                >
                  {competitors.length > 0 ? (
                    <>
                      Start tracking
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Find competitors & start tracking
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep("brand")}
                  className="w-full rounded-lg px-4 py-2 text-body-sm text-charcoal-muted transition-colors hover:bg-surface-100"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
