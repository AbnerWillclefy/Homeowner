import { config } from "../config";

export type HealthResult =
  | { kind: "ok" }
  | { kind: "unavailable" }
  | { kind: "unreachable" };

export const HEALTH_TIMEOUT_MS = 5000;

function hasStatus(body: unknown, status: string): boolean {
  return typeof body === "object" && body !== null && (body as { status?: unknown }).status === status;
}

/**
 * Asks the API whether it is healthy.
 * ok: 200 with {"status":"ok"}. unavailable: 503 with {"status":"unavailable"}.
 * unreachable: network or CORS failure, timeout, or any other response.
 */
export async function getHealth(signal?: AbortSignal): Promise<HealthResult> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), HEALTH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;

  try {
    const res = await fetch(`${config.apiBaseUrl}/healthz`, { signal: combined, cache: "no-store" });
    const body: unknown = await res.json();
    if (res.status === 200 && hasStatus(body, "ok")) return { kind: "ok" };
    if (res.status === 503 && hasStatus(body, "unavailable")) return { kind: "unavailable" };
    return { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
