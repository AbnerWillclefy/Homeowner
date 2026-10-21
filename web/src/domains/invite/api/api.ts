import type { AxiosResponse } from "axios";
import { httpClient } from "../../../shared/api/http";
import { parseHome, type Failure, type Home } from "../../home/api/api";
import { authedRequest, errorCode } from "../../auth/api/client";

/** Why an Invite cannot be used. The person needs a new link for any of them. */
export type DeadInvite = "not-found" | "used" | "expired";

export type CreateInviteResult =
  | { kind: "ok"; token: string; expiresAt: string }
  /** 404: the caller has no Home to invite anyone into. */
  | { kind: "none" }
  /** 429: too many unexpired Invites are open for this Home. */
  | { kind: "too-many" }
  | Failure;

export type LookupInviteResult = { kind: "valid" } | { kind: DeadInvite } | { kind: "offline" } | { kind: "error" };

export type AcceptInviteResult =
  | { kind: "ok"; home: Home }
  /** 409: joining means leaving the caller's current Home. Resend with confirmLeave. */
  | { kind: "would-leave" }
  /** 409: the caller already lives in the Home this Invite is for. */
  | { kind: "already-here" }
  | { kind: DeadInvite }
  | Failure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 404 and 410 mean the same for lookup and accept; null when the response is neither. */
function deadInvite(response: AxiosResponse): DeadInvite | null {
  if (response.status === 404) return "not-found";
  if (response.status !== 410) return null;
  const code = errorCode(response);
  return code === "used" || code === "expired" ? code : null;
}

/** A new single-use Invite to the caller's Home. The token is shown once; build the link from it. */
export async function createInvite(): Promise<CreateInviteResult> {
  try {
    const result = await authedRequest({ url: "/home/invites", method: "POST" });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 404) return { kind: "none" };
    if (response.status === 429) return { kind: "too-many" };
    if (response.status !== 201) return { kind: "error" };
    const body: unknown = response.data;
    if (!isRecord(body) || typeof body.token !== "string" || typeof body.expiresAt !== "string") {
      return { kind: "error" };
    }
    return { kind: "ok", token: body.token, expiresAt: body.expiresAt };
  } catch {
    return { kind: "offline" };
  }
}

/** Whether an Invite can still be used. Needs no session, and never uses the Invite up. */
export async function lookupInvite(token: string): Promise<LookupInviteResult> {
  try {
    const response = await httpClient.get(`/invites/${encodeURIComponent(token)}`);
    const dead = deadInvite(response);
    if (dead) return { kind: dead };
    return response.status === 200 ? { kind: "valid" } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Joins the Home the Invite is for. Pass `confirmLeave` once the person agreed to leave their current Home. */
export async function acceptInvite(token: string, confirmLeave: boolean): Promise<AcceptInviteResult> {
  try {
    const result = await authedRequest({
      url: `/invites/${encodeURIComponent(token)}/accept`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ confirmLeave }),
    });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    const dead = deadInvite(response);
    if (dead) return { kind: dead };
    if (response.status === 409) {
      const code = errorCode(response);
      if (code === "leaves current home") return { kind: "would-leave" };
      if (code === "already_here") return { kind: "already-here" };
      return { kind: "error" };
    }
    if (response.status !== 200) return { kind: "error" };
    const home = parseHome(response.data);
    return home ? { kind: "ok", home } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}
