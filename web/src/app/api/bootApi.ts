import { authedRequest } from "../../domains/auth/api/client";
import type { BootSections } from "../logic/boot";

/**
 * `GET /boot?month=`: the launch reads in one answer, `{ sections: { "<path>": { status, body } } }`. Null when the
 * boot failed in any way (no session, not 200, offline, a body of another shape); every read then goes to its own
 * endpoint.
 */
export async function getBoot(month: string): Promise<BootSections | null> {
  try {
    const result = await authedRequest({ url: "/boot", params: { month } });
    if (result.kind !== "response" || result.response.status !== 200) return null;
    return parseBoot(result.response.data);
  } catch {
    return null;
  }
}

function parseBoot(data: unknown): BootSections | null {
  const raw = typeof data === "object" && data !== null ? (data as { sections?: unknown }).sections : null;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const sections: BootSections = {};
  for (const [key, section] of Object.entries(raw)) {
    const { status, body } = (section ?? {}) as { status?: unknown; body?: unknown };
    if (typeof status !== "number" || !Number.isInteger(status)) return null;
    sections[key] = { status, body };
  }
  return sections;
}
