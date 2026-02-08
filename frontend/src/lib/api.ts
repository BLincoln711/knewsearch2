const API_KEY = process.env.NEXT_PUBLIC_READ_API_KEY || "";

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
  token?: string
): Promise<T> {
  const url = new URL(`/proxy${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json();
}

export async function apiMutate<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
  token?: string
): Promise<T> {
  const url = new URL(`/proxy${path}`, window.location.origin);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

// --- Response types ---

export interface BrandsResponse {
  brands: string[];
  total: number;
}

export interface OverviewDay {
  event_date: string;
  total_score: number;
  average_score: number;
  prompt_count: number;
}

export interface OverviewResponse {
  brand: string;
  days: number;
  data: OverviewDay[];
}

export interface PromptScore {
  prompt_id: string;
  score: number;
  brand_mentioned: boolean;
  citation_count: number;
  volatility_rank: number;
}

export interface PromptScoresResponse {
  brand: string;
  date: string;
  data: PromptScore[];
  total: number;
}

export interface WeeklySummaryResponse {
  brand: string;
  email_ready_text: string;
  created_at: string;
  week_start_date: string;
  week_end_date: string;
}

export interface HealthResponse {
  status: string;
  service: string;
}

// --- Prompt Management types ---

export interface Prompt {
  prompt_id: string;
  prompt_text: string;
  category: string;
  brand: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptsListResponse {
  brand: string;
  prompts: Prompt[];
  total: number;
  active_count: number;
}

export interface CreatePromptResponse {
  message: string;
  prompt_id: string;
}

export interface UpdatePromptResponse {
  message: string;
  prompt_id: string;
}

export interface AdminClientPromptsResponse {
  client_id: string;
  prompts: Prompt[];
  total: number;
  active_count: number;
}

// --- Admin types ---

export interface AdminClient {
  client_id: string;
  name: string;
  status: string;
  brands: string[];
  subscription_status: string | null;
  created_at: string;
  member_count?: number;
}

export interface AdminClientList {
  clients: AdminClient[];
  total: number;
}

export interface AdminMessage {
  message: string;
  client_id?: string;
  uid?: string;
}

// --- Billing types ---

export interface BillingInfo {
  client_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan_name: string | null;
}

export interface PortalSession {
  url: string;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
}
