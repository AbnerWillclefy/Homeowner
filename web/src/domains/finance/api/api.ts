import type { AxiosRequestConfig } from "axios";
import { authedRequest, errorCode } from "../../auth/api/client";

export interface FinanceSource {
  id: string;
  name: string;
  /** `checking`, `savings` or `credit_card`; the screen labels the ones it knows and shows others as they come. */
  kind: string;
  currency: string;
}

/** `GET /me/finance`. Never carries the credentials. */
export interface FinanceStatus {
  configured: boolean;
  sources: FinanceSource[];
  /** True while any bank has not finished its first import. */
  importing: boolean;
  /** RFC 3339, or null while any bank has never synced. */
  lastSyncedAt: string | null;
}

export type FinanceFailureKind =
  | "not-signed-in"
  | "offline"
  | "error"
  /** 400: the API refused the shape of the credentials. */
  | "invalid"
  /** 422 `pluggy_credentials_rejected`: Pluggy turned the credentials down. */
  | "rejected"
  /** 422 for an item Pluggy could not log in to, or one with no supported account. */
  | "item-refused"
  /** 409: there are no credentials to use. */
  | "no-credentials"
  /** 502: Pluggy did not answer. */
  | "unavailable";

type Failure = { kind: FinanceFailureKind };
export type WriteResult = { kind: "ok" } | Failure;
export type StatusResult = { kind: "ok"; status: FinanceStatus } | Failure;
export type ConnectTokenResult = { kind: "ok"; connectToken: string; includeSandbox: boolean } | Failure;

function parseStatus(body: unknown): FinanceStatus | null {
  if (typeof body !== "object" || body === null) return null;
  const { configured, sources, importing, lastSyncedAt } = body as Record<string, unknown>;
  if (typeof configured !== "boolean" || typeof importing !== "boolean" || !Array.isArray(sources)) return null;
  if (lastSyncedAt !== null && typeof lastSyncedAt !== "string") return null;
  const parsed: FinanceSource[] = [];
  for (const source of sources) {
    if (typeof source !== "object" || source === null) return null;
    const { id, name, kind, currency } = source as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || typeof kind !== "string" || typeof currency !== "string") return null;
    parsed.push({ id, name, kind, currency });
  }
  return { configured, sources: parsed, importing, lastSyncedAt };
}

/** The failure for a status that was not the expected one. */
function failureOf(status: number, code: string | null): FinanceFailureKind {
  if (status === 400) return "invalid";
  if (status === 409) return "no-credentials";
  if (status === 422) return code === "pluggy_credentials_rejected" ? "rejected" : "item-refused";
  if (status === 502) return "unavailable";
  return "error";
}

/** Sends one request and hands a success to `read`; every other outcome becomes a failure kind. */
async function call<T>(
  request: AxiosRequestConfig,
  success: number,
  read: (data: unknown) => T | null,
): Promise<({ kind: "ok" } & T) | Failure> {
  try {
    const result = await authedRequest(request);
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status !== success) return { kind: failureOf(response.status, errorCode(response)) };
    const value = read(response.data);
    return value === null ? { kind: "error" } : { kind: "ok", ...value };
  } catch {
    return { kind: "offline" };
  }
}

const nothing = () => ({});
const statusOf = (data: unknown) => {
  const status = parseStatus(data);
  return status && { status };
};

export const getFinanceStatus = (): Promise<StatusResult> => call({ url: "/me/finance" }, 200, statusOf) as Promise<StatusResult>;

/** The values go in the request body and nowhere else: not the URL, not a cache, not a log. */
export const putCredentials = (clientId: string, clientSecret: string): Promise<WriteResult> =>
  call({ url: "/me/finance/credentials", method: "PUT", data: { clientId, clientSecret } }, 204, nothing);

export const deleteCredentials = (): Promise<WriteResult> =>
  call({ url: "/me/finance/credentials", method: "DELETE" }, 204, nothing);

/** `DELETE /me/finance`: all the User's finance data and credentials. The banks stay connected in MeuPluggy. */
export const deleteFinanceData = (): Promise<WriteResult> => call({ url: "/me/finance", method: "DELETE" }, 204, nothing);

export const createConnectToken = (): Promise<ConnectTokenResult> =>
  call(
    { url: "/me/finance/connect-token", method: "POST" },
    200,
    (data) => {
      const { connectToken, includeSandbox } = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      return typeof connectToken === "string" && connectToken !== "" && typeof includeSandbox === "boolean"
        ? { connectToken, includeSandbox }
        : null;
    },
  ) as Promise<ConnectTokenResult>;

/** Registers the item the widget made. The answer is the new status. */
export const registerItem = (itemId: string): Promise<StatusResult> =>
  call({ url: "/me/finance/items", method: "POST", data: { itemId } }, 200, statusOf) as Promise<StatusResult>;
