import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { financeDeleted, financeStatusKey, invalidateMonth, monthKey, reportKey, writeFinanceStatus } from "./queries";
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

  it("keys each month under the status key, and invalidating one leaves the others", async () => {
    expect(monthKey("2026-11")).toEqual(["me", "finance", "transactions", "2026-11"]);
    const client = new QueryClient();
    client.setQueryData(monthKey("2026-11"), { n: 1 });
    client.setQueryData(monthKey("2026-10"), { n: 2 });
    client.setQueryData(reportKey("2026-12"), { n: 3 });
    await invalidateMonth(client, "2026-11");
    expect(client.getQueryState(reportKey("2026-12"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(monthKey("2026-11"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(monthKey("2026-10"))?.isInvalidated).toBe(false);
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
