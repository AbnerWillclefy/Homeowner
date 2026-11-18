import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import { QueryObserver } from "@tanstack/react-query";
import type { MeResult } from "./meApi";

const getMe = vi.fn<() => Promise<MeResult>>();
vi.mock("./meApi", () => ({ getMe: () => getMe() }));

const { meKey, meQuery } = await import("./queries");

const ME = { id: "u1", email: "a@b.c", displayName: null, name: "A", photoUrl: null, initials: "A", avatarTone: "kitchen" };

describe("meQuery", () => {
  beforeEach(() => getMe.mockReset());

  it("has a stable key shaped like the API path", () => {
    expect(meKey).toEqual(["me"]);
    expect(meQuery.queryKey).toEqual(["me"]);
  });

  it("returns the User without the result kind", async () => {
    getMe.mockResolvedValue({ kind: "ok", ...ME });
    expect(await createTestQueryClient().fetchQuery(meQuery)).toEqual(ME);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getMe.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(meQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });

  it("is read once when fetchQuery fills the cache and an observer then mounts (no second GET /me)", async () => {
    getMe.mockResolvedValue({ kind: "ok", ...ME });
    const client = createTestQueryClient();
    await client.fetchQuery(meQuery);
    const unsubscribe = new QueryObserver(client, meQuery).subscribe(() => {});
    await Promise.resolve();
    unsubscribe();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("still reads again on mount when the cached entry is a failure", async () => {
    getMe.mockResolvedValueOnce({ kind: "offline" }).mockResolvedValueOnce({ kind: "ok", ...ME });
    const client = createTestQueryClient();
    await client.fetchQuery(meQuery).catch(() => undefined);
    const observer = new QueryObserver(client, meQuery);
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(ME));
    unsubscribe();
    expect(getMe).toHaveBeenCalledTimes(2);
  });
});
