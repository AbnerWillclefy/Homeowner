import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { financeDeleted, financeStatusKey, writeFinanceStatus } from "./queries";
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
