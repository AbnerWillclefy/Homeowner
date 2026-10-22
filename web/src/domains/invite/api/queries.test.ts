import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { LookupInviteResult } from "./api";

const lookupInvite = vi.fn<(token: string) => Promise<LookupInviteResult>>();
vi.mock("./api", () => ({ lookupInvite: (token: string) => lookupInvite(token) }));

const { inviteKey, inviteQuery } = await import("./queries");

describe("inviteQuery", () => {
  beforeEach(() => lookupInvite.mockReset());

  it("is keyed by the token, outside the Home's key, so leaving a Home does not touch it", () => {
    expect(inviteKey("abc")).toEqual(["invites", "abc"]);
    expect(inviteQuery("abc").queryKey).toEqual(["invites", "abc"]);
  });

  it.each([{ kind: "valid" }, { kind: "not-found" }, { kind: "used" }, { kind: "expired" }] as const)(
    "returns %o as data",
    async (result) => {
      lookupInvite.mockResolvedValue(result);
      expect(await createTestQueryClient().fetchQuery(inviteQuery("abc"))).toEqual(result);
      expect(lookupInvite).toHaveBeenCalledWith("abc");
    },
  );

  it.each(["offline", "error"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    lookupInvite.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(inviteQuery("abc")).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
