import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFailure, toQueryData } from "./ApiFailure";
import { QueryObserver } from "@tanstack/react-query";
import { createQueryClient, refetchUnlessSucceeded } from "./queryClient";

afterEach(() => vi.unstubAllGlobals());

describe("createQueryClient", () => {
  it("sets the defaults the app relies on", () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();
    expect(queries).toMatchObject({ staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true, retry: false, networkMode: "always" });
    expect(mutations).toMatchObject({ retry: false, networkMode: "always" });
  });

  it("does not retry a not-signed-in failure", async () => {
    const queryFn = vi.fn().mockRejectedValue(new ApiFailure("not-signed-in"));
    await expect(createQueryClient().fetchQuery({ queryKey: ["me"], queryFn })).rejects.toMatchObject({ kind: "not-signed-in" });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("still runs the queryFn while the browser reports offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const queryFn = vi.fn().mockResolvedValue("data");
    await expect(createQueryClient().fetchQuery({ queryKey: ["home"], queryFn })).resolves.toBe("data");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

describe("refetchUnlessSucceeded", () => {
  const options = (queryFn: () => Promise<string>) => ({ queryKey: ["launch"], queryFn, refetchOnMount: refetchUnlessSucceeded });

  it("does not read again on mount when the prefetch succeeded", async () => {
    const queryFn = vi.fn().mockResolvedValue("data");
    const client = createQueryClient();
    await client.prefetchQuery(options(queryFn));
    const unsubscribe = new QueryObserver(client, options(queryFn)).subscribe(() => {});
    await Promise.resolve();
    unsubscribe();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("reads again on mount after a failed prefetch", async () => {
    const queryFn = vi.fn().mockRejectedValueOnce(new ApiFailure("offline")).mockResolvedValueOnce("data");
    const client = createQueryClient();
    await client.prefetchQuery(options(queryFn));
    const observer = new QueryObserver(client, options(queryFn));
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe("data"));
    unsubscribe();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});

describe("toQueryData", () => {
  it("returns the ok result", () => {
    const ok = { kind: "ok", name: "Ana" } as const;
    expect(toQueryData(ok)).toBe(ok);
  });

  it("returns null for none", () => {
    expect(toQueryData({ kind: "none" })).toBeNull();
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure for %s", (kind) => {
    const run = () => toQueryData({ kind });
    expect(run).toThrow(ApiFailure);
    expect(run).toThrow(expect.objectContaining({ kind }));
  });
});
