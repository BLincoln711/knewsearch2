const API_KEY = process.env.NEXT_PUBLIC_READ_API_KEY || "";

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>
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

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
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
