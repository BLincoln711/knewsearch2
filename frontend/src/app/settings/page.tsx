"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Activity, CreditCard } from "lucide-react";

const tabs = [
  { key: "queries", label: "Monitored Queries", icon: Search },
  { key: "health", label: "Data Health", icon: Activity },
  { key: "billing", label: "Billing", icon: CreditCard },
] as const;

type Tab = (typeof tabs)[number]["key"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("queries");

  return (
    <div className="space-y-8">
      <h1 className="text-heading tracking-tight text-charcoal">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-surface-200 pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                active
                  ? "border-primary-600 text-primary-700 bg-primary-50/50"
                  : "border-transparent text-charcoal-muted hover:text-charcoal hover:bg-surface-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "queries" && (
        <div className="rounded-2xl bg-surface-0 p-8 shadow-card">
          <p className="text-body-sm text-charcoal-light">
            Manage the AI search queries being tracked for your brand.
          </p>
          <Link
            href="/tracked-searches"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-body-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <Search className="h-4 w-4" />
            Manage Queries
          </Link>
        </div>
      )}

      {activeTab === "health" && (
        <div className="rounded-2xl bg-surface-0 p-8 shadow-card">
          <p className="text-body-sm text-charcoal-light">
            Check the status of your data pipeline and API connectivity.
          </p>
          <Link
            href="/data-health"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-body-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <Activity className="h-4 w-4" />
            View Data Health
          </Link>
        </div>
      )}

      {activeTab === "billing" && (
        <div className="rounded-2xl bg-surface-0 p-8 shadow-card">
          <p className="text-body-sm text-charcoal-light">
            Manage your subscription and payment details.
          </p>
          <Link
            href="/billing"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-body-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <CreditCard className="h-4 w-4" />
            Manage Billing
          </Link>
        </div>
      )}
    </div>
  );
}
