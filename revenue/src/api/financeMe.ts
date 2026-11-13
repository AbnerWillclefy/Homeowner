import { useQuery } from "@tanstack/react-query";
import { apiClient, NotSignedIn } from "./client";

/** What `GET /me/finance` said. 403 and 401 are answers, not errors; 503, a network failure or anything else throws. */
export type FinanceMe = { kind: "ok" } | { kind: "forbidden" } | { kind: "unauthorized" };

export async function fetchFinanceMe(): Promise<FinanceMe> {
  let response;
  try {
    response = await apiClient.get("/me/finance");
  } catch (error) {
    if (error instanceof NotSignedIn) return { kind: "unauthorized" };
    throw error;
  }
  if (response.status === 200) return { kind: "ok" };
  if (response.status === 403) return { kind: "forbidden" };
  if (response.status === 401) return { kind: "unauthorized" };
  // 503 "finance not configured" lands here: an error with Retry, never "no access".
  throw new Error(`GET /me/finance answered ${response.status}`);
}

export const FINANCE_ME_KEY = ["finance", "me"] as const;

export function useFinanceMe() {
  return useQuery({ queryKey: FINANCE_ME_KEY, queryFn: fetchFinanceMe, staleTime: 5 * 60_000 });
}
