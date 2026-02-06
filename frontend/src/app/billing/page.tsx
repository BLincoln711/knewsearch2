"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { useAuthedMutate } from "@/lib/use-authed-fetch";
import { BillingInfo, PortalSession, CheckoutSession } from "@/lib/api";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { CreditCard, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";

function statusDisplay(status: string | null) {
  if (!status) return { label: "No subscription", color: "text-charcoal-muted", bg: "bg-surface-100" };
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: "Active", color: "text-positive-700", bg: "bg-positive-50" },
    trialing: { label: "Trial", color: "text-primary-700", bg: "bg-primary-50" },
    past_due: { label: "Past Due", color: "text-amber-700", bg: "bg-amber-50" },
    canceled: { label: "Canceled", color: "text-red-700", bg: "bg-red-50" },
    incomplete: { label: "Incomplete", color: "text-amber-700", bg: "bg-amber-50" },
  };
  return map[status] || { label: status, color: "text-charcoal-muted", bg: "bg-surface-100" };
}

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const authedFetch = useAuthedFetch();
  const authedMutate = useAuthedMutate();

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    authedFetch<BillingInfo>("/billing/info")
      .then(setBilling)
      .catch(() => {
        // If billing endpoint fails (not admin, no subscription), that's ok
        setBilling(null);
      })
      .finally(() => setLoading(false));
  }, [user, authedFetch]);

  const handleManageBilling = async () => {
    setRedirecting(true);
    setError(null);
    try {
      const session = await authedMutate<PortalSession>(
        "/billing/portal-session",
        "POST"
      );
      window.location.href = session.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
      setRedirecting(false);
    }
  };

  const handleSubscribe = async () => {
    setRedirecting(true);
    setError(null);
    try {
      const session = await authedMutate<CheckoutSession>(
        "/billing/checkout-session",
        "POST"
      );
      window.location.href = session.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setRedirecting(false);
    }
  };

  if (authLoading || loading) return <LoadingSpinner />;

  const status = statusDisplay(billing?.subscription_status || null);
  const hasActiveSubscription = billing?.subscription_status === "active" || billing?.subscription_status === "trialing";

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-heading tracking-tight text-charcoal">Billing</h1>

      {error && <ErrorBanner message={error} />}

      {/* Subscription Status Card */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-primary-600" />
          <h2 className="text-body-lg font-semibold text-charcoal">
            Subscription
          </h2>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-surface-50 p-4">
          <div>
            <p className="text-body-sm font-medium text-charcoal">
              {billing?.plan_name || "KnewSearch Visibility Dashboard"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${status.bg} ${status.color}`}
              >
                {status.label}
              </span>
              {billing?.cancel_at_period_end && (
                <span className="text-caption text-amber-600">
                  Cancels at period end
                </span>
              )}
            </div>
          </div>
          {hasActiveSubscription ? (
            <CheckCircle className="h-5 w-5 text-positive-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
        </div>

        {billing?.current_period_end && (
          <p className="text-body-sm text-charcoal-muted">
            Current period ends:{" "}
            <span className="font-medium text-charcoal">
              {new Date(billing.current_period_end).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </p>
        )}

        <div className="flex gap-3 pt-2">
          {hasActiveSubscription ? (
            <button
              onClick={handleManageBilling}
              disabled={redirecting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 rounded-xl transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {redirecting ? "Opening..." : "Manage Billing"}
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={redirecting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 rounded-xl transition-colors"
            >
              {redirecting ? "Redirecting..." : "Subscribe Now"}
            </button>
          )}
        </div>
      </div>

      <p className="text-caption text-charcoal-faint">
        Billing is managed securely through Stripe. You can update your payment
        method, view invoices, or cancel your subscription from the billing
        portal.
      </p>
    </div>
  );
}
