"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth-context";
import { apiFetch, apiMutate } from "./api";

export function useAuthedFetch() {
  const { getIdToken } = useAuth();

  const authedFetch = useCallback(
    async <T>(path: string, params?: Record<string, string>): Promise<T> => {
      const token = await getIdToken();
      return apiFetch<T>(path, params, token ?? undefined);
    },
    [getIdToken]
  );

  return authedFetch;
}

export function useAuthedMutate() {
  const { getIdToken } = useAuth();

  const authedMutate = useCallback(
    async <T>(
      path: string,
      method: "POST" | "PUT" | "DELETE",
      body?: unknown
    ): Promise<T> => {
      const token = await getIdToken();
      return apiMutate<T>(path, method, body, token ?? undefined);
    },
    [getIdToken]
  );

  return authedMutate;
}
