import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { describe, expect, it, vi } from "vitest";
import { commitmentsKey, dailyKey, financeDeleted, financeStatusKey, historyKey, invalidateFinance, invalidateMonth, monthKey, writeFinanceStatus } from "./queries";
import type { FinanceStatus } from "./api";

const STATUS: FinanceStatus = { configured: true, sources: [], importing: true, lastSyncedAt: null };

describe("finance cache", () => {
  it("keeps the status under the Me scope, emptied on sign-out", () => {
    expect(financeStatusKey).toEqual(["me", "finance"]);
  });

  it("writes a status over the cached one", async () => {
    const client = new QueryClient();
    await writeFinanceStatus(client, STATUS);
    expect(client.getQueryData(financeStatusKey)).toEqual(STATUS);
  });

  it("keys each month under the status key, and a PATCH invalidates every month but not other finance reads", async () => {
    expect(monthKey("2026-11")).toEqual(["me", "finance", "transactions", "2026-11"]);
    const client = new QueryClient();
    client.setQueryData(monthKey("2026-11"), { n: 1 });
    client.setQueryData(monthKey("2026-10"), { n: 2 });
    client.setQueryData(commitmentsKey("2026-12"), { n: 3 });
    await invalidateMonth(client);
    expect(client.getQueryState(monthKey("2026-11"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(monthKey("2026-10"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(commitmentsKey("2026-12"))?.isInvalidated).toBe(false);
  });

  it("keys history with every parameter, and a PATCH marks it stale", async () => {
    expect(historyKey("2026-11", 6)).toEqual(["me", "finance", "history", "2026-11", 6]);
    const client = new QueryClient();
    client.setQueryData(historyKey("2026-11", 6), { n: 1 });
    await invalidateMonth(client);
    expect(client.getQueryState(historyKey("2026-11", 6))?.isInvalidated).toBe(true);
  });

  it("keys the daily series by month, and a PATCH marks it stale", async () => {
    expect(dailyKey("2026-11")).toEqual(["me", "finance", "daily", "2026-11"]);
    const client = new QueryClient();
    client.setQueryData(dailyKey("2026-11"), { n: 1 });
    await invalidateMonth(client);
    expect(client.getQueryState(dailyKey("2026-11"))?.isInvalidated).toBe(true);
  });

  it("keys commitments under the finance prefix, which invalidateFinance marks stale", async () => {
    expect(commitmentsKey("2026-11")).toEqual(["me", "finance", "commitments", "2026-11"]);
    const client = new QueryClient();
    client.setQueryData(commitmentsKey("2026-11"), { n: 1 });
    client.setQueryData(["me", "profile"], { n: 2 });
    await invalidateFinance(client);
    expect(client.getQueryState(commitmentsKey("2026-11"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(["me", "profile"])?.isInvalidated).toBe(false);
  });

  it("leaves an inactive finance query alone, then reads it when it mounts again so a rename is there", async () => {
    const client = new QueryClient();
    const queryFn = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
    const options = { queryKey: monthKey("2026-11"), queryFn, refetchOnMount: refetchUnlessSucceeded };
    await client.prefetchQuery(options);
    await invalidateFinance(client);
    expect(queryFn).toHaveBeenCalledTimes(1);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual({ n: 2 }));
    unsubscribe();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("drops every finance entry after a delete, keeps ['me'], and sets the empty status", async () => {
    const client = new QueryClient();
    client.setQueryData(["me"], { finance: true });
    client.setQueryData(["me", "finance"], STATUS);
    client.setQueryData(["me", "finance", "month", "2026-10"], { total: 1 });
    client.setQueryData(["me", "profile"], { p: 1 });
    await financeDeleted(client);
    expect(client.getQueryData(["me"])).toEqual({ finance: true });
    expect(client.getQueryData(["me", "profile"])).toEqual({ p: 1 });
    expect(client.getQueryData(["me", "finance", "month", "2026-10"])).toBeUndefined();
    expect(client.getQueryData(financeStatusKey)).toEqual({ configured: false, sources: [], importing: false, lastSyncedAt: null });
  });
});
