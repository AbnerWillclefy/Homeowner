import { useQuery } from "@tanstack/react-query";
import { apiClient, NotSignedIn } from "./client";

/** What `GET /admin/me` said. 403 and 401 are answers, not errors; anything else unexpected throws. */
export type AdminMe =
  | { kind: "ok"; environment: string }
  /** Signed in, but not in the super-admin group. */
  | { kind: "forbidden" }
  /** The session is not valid (the client has already tried to refresh it). */
  | { kind: "unauthorized" };

export async function fetchAdminMe(): Promise<AdminMe> {
  let response;
  try {
    response = await apiClient.get("/admin/me");
  } catch (error) {
    if (error instanceof NotSignedIn) return { kind: "unauthorized" };
    throw error;
  }
  if (response.status === 403) return { kind: "forbidden" };
  if (response.status === 401) return { kind: "unauthorized" };
  const body: unknown = response.data;
  const environment =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).environment : undefined;
  if (response.status === 200 && typeof environment === "string") return { kind: "ok", environment };
  throw new Error(`GET /admin/me answered ${response.status}`);
}

export const ADMIN_ME_KEY = ["admin", "me"] as const;

/** Who the API says this is. Pass `enabled: false` while signed out, so nothing is requested before sign-in. */
export function useAdminMe(enabled = true) {
  return useQuery({ queryKey: ADMIN_ME_KEY, queryFn: fetchAdminMe, enabled, staleTime: 5 * 60_000 });
}
