import { beforeEach, describe, expect, it } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { createTestQueryClient } from "../../../shared/query/testing";
import { forgetHomeScope, homeJoined, homeKey, homeLeft } from "./queries";

const HOME = { id: "h1", timezone: "America/Sao_Paulo", allocationTime: "07:00" };

function seeded(): QueryClient {
  const client = createTestQueryClient();
  client.setQueryData(homeKey, HOME);
  client.setQueryData(["home", "day-plan"], { planned: true });
  client.setQueryData(["home", "chores"], []);
  client.setQueryData(["home", "residents", "r1"], { id: "r1" });
  client.setQueryData(["me"], { id: "u1" });
  client.setQueryData(["categories"], ["kitchen"]);
  return client;
}

const keys = (client: QueryClient) =>
  client
    .getQueryCache()
    .getAll()
    .map((q) => JSON.stringify(q.queryKey))
    .sort();

const KEPT = [["categories"], ["home"], ["me"]].map((k) => JSON.stringify(k)).sort();

describe("the Home scope in the cache", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = seeded();
  });

  it("forgetHomeScope removes every child of the Home and keeps the Home itself and the rest", async () => {
    await forgetHomeScope(client);
    expect(keys(client)).toEqual(KEPT);
  });

  it("leaving leaves no data of the old Home in the cache and the Home reads as none", async () => {
    await homeLeft(client);
    expect(keys(client)).toEqual(KEPT);
    expect(client.getQueryData(homeKey)).toBeNull();
  });

  it("joining empties every child, not only marks them stale, and marks the Home stale", async () => {
    await homeJoined(client);
    expect(client.getQueryData(["home", "chores"])).toBeUndefined();
    expect(client.getQueryData(["home", "residents", "r1"])).toBeUndefined();
    expect(client.getQueryData(["me"])).toEqual({ id: "u1" });
    expect(client.getQueryState(homeKey)?.isInvalidated).toBe(true);
  });

  it("does not touch a query whose key only starts with the letters of home", async () => {
    client.setQueryData(["homes", "x"], 1);
    await forgetHomeScope(client);
    expect(client.getQueryData(["homes", "x"])).toBe(1);
  });
});
