"use client";

import { useEffect, useState, useCallback } from "react";
import { useBrand } from "@/components/brand-context";
import { PromptsListResponse, Prompt } from "@/lib/api";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { useAuthedMutate } from "@/lib/use-authed-fetch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Plus, Pencil, X } from "lucide-react";

const CATEGORIES = ["All", "Brand", "Competitor", "Industry", "Custom"] as const;

const categoryColors: Record<string, string> = {
  brand: "bg-primary-50 text-primary-700",
  competitor: "bg-amber-50 text-amber-700",
  industry: "bg-emerald-50 text-emerald-700",
  custom: "bg-surface-100 text-charcoal-muted",
};

export default function TrackedSearchesPage() {
  const { selectedBrand, brands, loading: brandLoading } = useBrand();
  const authedFetch = useAuthedFetch();
  const authedMutate = useAuthedMutate();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [confirmPrompt, setConfirmPrompt] = useState<Prompt | null>(null);

  const fetchPrompts = useCallback(() => {
    if (!selectedBrand) return;
    setLoading(true);
    setError(null);
    authedFetch<PromptsListResponse>("/prompts", { brand: selectedBrand })
      .then((res) => {
        setPrompts(res.prompts);
        setTotal(res.total);
        setActiveCount(res.active_count);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedBrand, authedFetch]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleToggle = async (prompt: Prompt) => {
    if (prompt.is_active) {
      setConfirmPrompt(prompt);
      return;
    }
    try {
      await authedMutate(`/prompts/${prompt.prompt_id}`, "PUT", { is_active: true });
      showSuccess("Search reactivated");
      fetchPrompts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const confirmDeactivate = async () => {
    if (!confirmPrompt) return;
    try {
      await authedMutate(`/prompts/${confirmPrompt.prompt_id}`, "PUT", { is_active: false });
      showSuccess("Search deactivated");
      setConfirmPrompt(null);
      fetchPrompts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate");
      setConfirmPrompt(null);
    }
  };

  const filtered =
    categoryFilter === "All"
      ? prompts
      : prompts.filter(
          (p) => (p.category || "brand").toLowerCase() === categoryFilter.toLowerCase()
        );

  if (brandLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-heading tracking-tight text-charcoal">
            Tracked Searches
          </h1>
          {!loading && (
            <span className="rounded-full bg-primary-50 px-3 py-1 text-caption font-medium text-primary-700">
              {activeCount} of {total} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-800"
        >
          <Plus className="h-4 w-4" />
          Add Search
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-body-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-body-sm rounded-lg transition-colors ${
              categoryFilter === cat
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-charcoal-muted hover:text-charcoal hover:bg-surface-100"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorBanner message={error} />}

      {/* Empty state */}
      {!loading && !error && prompts.length === 0 && (
        <EmptyState
          title="No tracked searches yet"
          message="Tracked searches are the AI search queries KnewSearch monitors for your brand's visibility. Add your first search to start tracking how your brand appears in AI-generated answers."
        />
      )}

      {/* Prompt table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-surface-0 shadow-card">
          <table className="min-w-full divide-y divide-surface-100">
            <thead>
              <tr className="bg-surface-50 text-left text-caption font-medium uppercase tracking-wider text-charcoal-muted">
                <th className="px-6 py-3">Search Query</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((prompt) => (
                <tr
                  key={prompt.prompt_id}
                  className="hover:bg-surface-50 transition-colors"
                >
                  <td className="px-6 py-4 text-body-sm text-charcoal-light max-w-md">
                    <span className="line-clamp-2">{prompt.prompt_text}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-caption font-medium ${
                        categoryColors[(prompt.category || "brand").toLowerCase()] ||
                        categoryColors.custom
                      }`}
                    >
                      {(prompt.category || "brand").charAt(0).toUpperCase() +
                        (prompt.category || "brand").slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggle(prompt)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        prompt.is_active ? "bg-positive-500" : "bg-surface-300"
                      }`}
                      title={prompt.is_active ? "Active - click to deactivate" : "Inactive - click to activate"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                          prompt.is_active ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-caption text-charcoal-faint">
                    {prompt.updated_at
                      ? new Date(prompt.updated_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setEditingPrompt(prompt)}
                      className="rounded-lg p-1.5 text-charcoal-muted transition-colors hover:bg-surface-100 hover:text-charcoal"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filtered empty */}
      {!loading && !error && prompts.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-body-sm text-charcoal-muted">
          No searches in the &quot;{categoryFilter}&quot; category.
        </div>
      )}

      {/* Deactivation confirmation dialog */}
      {confirmPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl bg-surface-0 p-6 shadow-card">
            <h3 className="text-body font-semibold text-charcoal">
              Deactivate this search?
            </h3>
            <p className="mt-2 text-body-sm text-charcoal-light">
              Deactivating this search stops collecting visibility data for it.
              You can reactivate it later.
            </p>
            <p className="mt-3 rounded-lg bg-surface-50 p-3 text-caption text-charcoal-muted">
              &ldquo;{confirmPrompt.prompt_text}&rdquo;
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmPrompt(null)}
                className="rounded-lg px-4 py-2 text-body-sm text-charcoal-muted transition-colors hover:bg-surface-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                className="rounded-lg bg-red-600 px-4 py-2 text-body-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Search Modal */}
      {showAddModal && (
        <AddSearchModal
          brands={brands}
          defaultBrand={selectedBrand}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            showSuccess("Search added");
            fetchPrompts();
          }}
          authedMutate={authedMutate}
        />
      )}

      {/* Edit Search Modal */}
      {editingPrompt && (
        <EditSearchModal
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSuccess={() => {
            setEditingPrompt(null);
            showSuccess("Search updated");
            fetchPrompts();
          }}
          authedMutate={authedMutate}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add Search Modal                                                    */
/* ------------------------------------------------------------------ */

function AddSearchModal({
  brands,
  defaultBrand,
  onClose,
  onSuccess,
  authedMutate,
}: {
  brands: string[];
  defaultBrand: string;
  onClose: () => void;
  onSuccess: () => void;
  authedMutate: <T>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) => Promise<T>;
}) {
  const [text, setText] = useState("");
  const [brand, setBrand] = useState(defaultBrand);
  const [category, setCategory] = useState("brand");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await authedMutate("/prompts", "POST", {
        prompt_text: text.trim(),
        brand,
        category,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-surface-0 p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-charcoal">
            Add Tracked Search
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-charcoal-muted hover:bg-surface-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-body-sm font-medium text-charcoal-light mb-1">
              Search Query
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required
              placeholder="e.g. What companies provide AI search visibility services?"
              className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-medium text-charcoal-light mb-1">
                Brand
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-body-sm font-medium text-charcoal-light mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="brand">Brand</option>
                <option value="competitor">Competitor</option>
                <option value="industry">Industry</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-charcoal-light mb-1">
              Keywords (optional, comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. ai visibility, search measurement"
              className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-body-sm text-charcoal-muted transition-colors hover:bg-surface-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="rounded-lg bg-primary-700 px-4 py-2 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Search"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Search Modal                                                   */
/* ------------------------------------------------------------------ */

function EditSearchModal({
  prompt,
  onClose,
  onSuccess,
  authedMutate,
}: {
  prompt: Prompt;
  onClose: () => void;
  onSuccess: () => void;
  authedMutate: <T>(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) => Promise<T>;
}) {
  const [text, setText] = useState(prompt.prompt_text);
  const [category, setCategory] = useState(prompt.category || "brand");
  const [keywords, setKeywords] = useState((prompt.keywords || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await authedMutate(`/prompts/${prompt.prompt_id}`, "PUT", {
        prompt_text: text.trim(),
        category,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-2xl bg-surface-0 p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-charcoal">
            Edit Search
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-charcoal-muted hover:bg-surface-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <ErrorBanner message={error} />}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-body-sm font-medium text-charcoal-light mb-1">
              Search Query
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required
              className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-medium text-charcoal-light mb-1">
                Brand
              </label>
              <input
                type="text"
                value={prompt.brand}
                disabled
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-body-sm text-charcoal-muted"
              />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-charcoal-light mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="brand">Brand</option>
                <option value="competitor">Competitor</option>
                <option value="industry">Industry</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-charcoal-light mb-1">
              Keywords (optional, comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-body-sm text-charcoal-light shadow-subtle focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-body-sm text-charcoal-muted transition-colors hover:bg-surface-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="rounded-lg bg-primary-700 px-4 py-2 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
