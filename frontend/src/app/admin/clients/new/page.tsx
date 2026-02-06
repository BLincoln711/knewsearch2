"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthedMutate } from "@/lib/use-authed-fetch";
import { AdminMessage } from "@/lib/api";
import { ErrorBanner } from "@/components/error-banner";
import { Plus, X } from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();
  const authedMutate = useAuthedMutate();

  const [name, setName] = useState("");
  const [brands, setBrands] = useState<string[]>([""]);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addBrand = () => setBrands([...brands, ""]);
  const removeBrand = (i: number) =>
    setBrands(brands.filter((_, idx) => idx !== i));
  const updateBrand = (i: number, value: string) =>
    setBrands(brands.map((b, idx) => (idx === i ? value : b)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanBrands = brands.map((b) => b.trim()).filter(Boolean);
    if (!name.trim()) {
      setError("Client name is required.");
      return;
    }
    if (cleanBrands.length === 0) {
      setError("At least one brand is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authedMutate<AdminMessage>(
        "/admin/clients",
        "POST",
        {
          name: name.trim(),
          brands: cleanBrands,
          contact_email: contactEmail.trim() || undefined,
          contact_name: contactName.trim() || undefined,
        }
      );
      if (result.client_id) {
        router.push(`/admin/clients/${result.client_id}`);
      } else {
        router.push("/admin");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-heading-sm tracking-tight text-charcoal mb-6">
        Create New Client
      </h2>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-5">
          <div>
            <label className="block text-body-sm font-medium text-charcoal mb-1.5">
              Client Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corporation"
              className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              required
            />
          </div>

          <div>
            <label className="block text-body-sm font-medium text-charcoal mb-1.5">
              Brands
            </label>
            <div className="space-y-2">
              {brands.map((brand, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => updateBrand(i, e.target.value)}
                    placeholder="Brand name"
                    className="flex-1 rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  {brands.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBrand(i)}
                      className="rounded-lg p-2.5 text-charcoal-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addBrand}
              className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another brand
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-5">
          <p className="text-body-sm font-medium text-charcoal">
            Primary Contact (optional)
          </p>
          <p className="text-caption text-charcoal-muted -mt-3">
            If provided, an account will be created and the user will be invited.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-medium text-charcoal mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-charcoal mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@acme.com"
                className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            {submitting ? "Creating..." : "Create Client"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="px-6 py-2.5 text-body-sm font-medium text-charcoal-muted hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
