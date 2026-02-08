"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthedFetch } from "@/lib/use-authed-fetch";
import { useAuthedMutate } from "@/lib/use-authed-fetch";
import { AdminClient, AdminMessage, BillingInfo, Prompt, AdminClientPromptsResponse } from "@/lib/api";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ErrorBanner } from "@/components/error-banner";
import {
  Users,
  Tag,
  Plus,
  UserPlus,
  X,
  Save,
  CreditCard,
  Search,
} from "lucide-react";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const authedFetch = useAuthedFetch();
  const authedMutate = useAuthedMutate();

  const [client, setClient] = useState<AdminClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // Add brand
  const [newBrand, setNewBrand] = useState("");
  const [addingBrand, setAddingBrand] = useState(false);

  // Invite user
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("client_member");
  const [inviting, setInviting] = useState(false);

  // Prompts
  const [clientPrompts, setClientPrompts] = useState<Prompt[]>([]);
  const [promptsTotal, setPromptsTotal] = useState(0);
  const [promptsActiveCount, setPromptsActiveCount] = useState(0);

  // Billing
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [creatingSubscription, setCreatingSubscription] = useState(false);

  // Feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchClient = () => {
    setLoading(true);
    setError(null);
    authedFetch<AdminClient>(`/admin/clients/${clientId}`)
      .then((res) => {
        setClient(res);
        setEditName(res.name);
        setEditStatus(res.status);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Fetch billing info and prompts in parallel
    authedFetch<BillingInfo>(`/admin/clients/${clientId}/billing`)
      .then(setBilling)
      .catch(() => setBilling(null));

    authedFetch<AdminClientPromptsResponse>(`/admin/clients/${clientId}/prompts`)
      .then((res) => {
        setClientPrompts(res.prompts);
        setPromptsTotal(res.total);
        setPromptsActiveCount(res.active_count);
      })
      .catch(() => setClientPrompts([]));
  };

  useEffect(() => {
    fetchClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    setError(null);
    try {
      await authedMutate<AdminMessage>(
        `/admin/clients/${clientId}`,
        "PUT",
        { name: editName, status: editStatus }
      );
      showSuccess("Client updated successfully.");
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBrand = async () => {
    if (!newBrand.trim()) return;
    setAddingBrand(true);
    setError(null);
    try {
      await authedMutate<AdminMessage>(
        `/admin/clients/${clientId}/brands`,
        "POST",
        { brands: [newBrand.trim()] }
      );
      setNewBrand("");
      showSuccess(`Brand "${newBrand.trim()}" added.`);
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add brand");
    } finally {
      setAddingBrand(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await authedMutate<AdminMessage>(
        `/admin/clients/${clientId}/invite`,
        "POST",
        {
          email: inviteEmail.trim(),
          display_name: inviteName.trim() || undefined,
          role: inviteRole,
        }
      );
      setInviteEmail("");
      setInviteName("");
      showSuccess(`Invited ${inviteEmail.trim()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleCreateSubscription = async () => {
    setCreatingSubscription(true);
    setError(null);
    try {
      const result = await authedMutate<BillingInfo>(
        `/admin/clients/${clientId}/subscription`,
        "POST",
        { trial_days: 14 }
      );
      setBilling(result);
      showSuccess("Subscription created successfully.");
      fetchClient();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create subscription");
    } finally {
      setCreatingSubscription(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error && !client) return <ErrorBanner message={error} />;
  if (!client) return <ErrorBanner message="Client not found" />;

  return (
    <div className="space-y-6 max-w-3xl">
      {successMsg && (
        <div className="rounded-xl bg-positive-50 px-4 py-3 text-body-sm text-positive-700">
          {successMsg}
        </div>
      )}
      {error && <ErrorBanner message={error} />}

      {/* Client Details Card */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-5 w-5 text-primary-600" />
          <h2 className="text-body-lg font-semibold text-charcoal">
            Client Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-medium text-charcoal mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-charcoal mb-1.5">
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="churned">Churned</option>
            </select>
          </div>
        </div>

        <div className="text-caption text-charcoal-faint">
          Client ID: {client.client_id}
          {client.created_at && <> &middot; Created: {client.created_at}</>}
        </div>

        <button
          onClick={handleSaveDetails}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 rounded-lg transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Brands Card */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Tag className="h-5 w-5 text-primary-600" />
          <h2 className="text-body-lg font-semibold text-charcoal">Brands</h2>
        </div>

        {client.brands.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {client.brands.map((brand) => (
              <span
                key={brand}
                className="inline-flex items-center rounded-lg bg-surface-100 px-3 py-1.5 text-body-sm text-charcoal-light"
              >
                {brand}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-body-sm text-charcoal-muted">
            No brands assigned yet.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="Add a brand name"
            className="flex-1 rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddBrand();
              }
            }}
          />
          <button
            onClick={handleAddBrand}
            disabled={addingBrand || !newBrand.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            {addingBrand ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Tracked Searches Card */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-primary-600" />
            <h2 className="text-body-lg font-semibold text-charcoal">
              Tracked Searches
            </h2>
          </div>
          {promptsTotal > 0 && (
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-caption font-medium text-primary-700">
              {promptsActiveCount} of {promptsTotal} active
            </span>
          )}
        </div>

        {clientPrompts.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-surface-100">
            <table className="min-w-full divide-y divide-surface-100">
              <thead>
                <tr className="bg-surface-50 text-left text-caption font-medium uppercase tracking-wider text-charcoal-muted">
                  <th className="px-4 py-2">Query</th>
                  <th className="px-4 py-2">Brand</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-center">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {clientPrompts.map((p) => (
                  <tr key={p.prompt_id} className="text-body-sm">
                    <td className="px-4 py-2.5 text-charcoal-light max-w-xs truncate">
                      {p.prompt_text.length > 60
                        ? p.prompt_text.slice(0, 60) + "..."
                        : p.prompt_text}
                    </td>
                    <td className="px-4 py-2.5 text-charcoal-muted">
                      {p.brand}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-caption font-medium ${
                          p.category === "brand"
                            ? "bg-primary-50 text-primary-700"
                            : p.category === "competitor"
                            ? "bg-amber-50 text-amber-700"
                            : p.category === "industry"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-surface-100 text-charcoal-muted"
                        }`}
                      >
                        {(p.category || "brand").charAt(0).toUpperCase() +
                          (p.category || "brand").slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          p.is_active ? "bg-positive-500" : "bg-surface-300"
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-sm text-charcoal-muted">
            No prompts configured for this client.
          </p>
        )}
      </div>

      {/* Invite User Card */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <UserPlus className="h-5 w-5 text-primary-600" />
          <h2 className="text-body-lg font-semibold text-charcoal">
            Invite User
          </h2>
        </div>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-medium text-charcoal mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                required
                className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-charcoal mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal placeholder:text-charcoal-faint focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-body-sm font-medium text-charcoal mb-1.5">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full sm:w-auto rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 text-body-sm text-charcoal focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="client_member">Member</option>
              <option value="client_admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {inviting ? "Inviting..." : "Send Invite"}
          </button>
        </form>
      </div>
      {/* Billing Card */}
      <div className="rounded-2xl bg-surface-0 p-6 shadow-card space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-5 w-5 text-primary-600" />
          <h2 className="text-body-lg font-semibold text-charcoal">Billing</h2>
        </div>

        {billing?.stripe_subscription_id ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-surface-50 p-4">
              <div>
                <p className="text-body-sm font-medium text-charcoal">
                  {billing.plan_name || "KnewSearch Visibility Dashboard"}
                </p>
                <p className="mt-0.5 text-caption text-charcoal-muted">
                  Subscription ID: {billing.stripe_subscription_id}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-medium ${
                  billing.subscription_status === "active"
                    ? "bg-positive-50 text-positive-700"
                    : billing.subscription_status === "trialing"
                    ? "bg-primary-50 text-primary-700"
                    : billing.subscription_status === "past_due"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {billing.subscription_status}
              </span>
            </div>

            {billing.current_period_end && (
              <p className="text-body-sm text-charcoal-muted">
                Current period ends:{" "}
                <span className="font-medium text-charcoal">
                  {new Date(billing.current_period_end).toLocaleDateString(
                    "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              </p>
            )}

            {billing.cancel_at_period_end && (
              <p className="text-body-sm text-amber-600">
                Subscription will cancel at period end.
              </p>
            )}

            <div className="text-caption text-charcoal-faint">
              Stripe Customer: {billing.stripe_customer_id}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-body-sm text-charcoal-muted">
              No active subscription. Create one to enable billing for this
              client.
            </p>
            <button
              onClick={handleCreateSubscription}
              disabled={creatingSubscription}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-body-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              {creatingSubscription
                ? "Creating..."
                : "Create Subscription (14-day trial)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
