import { QueryObserver, type QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../shared/query/testing";
import { dayPlanKey } from "../../dayplan/api/queries";
import { streakKey } from "../../streak/api/queries";
import { residentKey, residentsKey } from "../api/queries";
import { residentDetail } from "../testing/fixtures";
import { writeMovedCompletion } from "./completionCache";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

/** Watches a key like a mounted screen would, counting how many times it is read. */
function watch(client: ReturnType<typeof createTestQueryClient>, queryKey: QueryKey, data: unknown) {
  const reads = { count: 0 };
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: async () => {
      reads.count += 1;
      return data;
    },
    staleTime: 60_000,
  });
  return { reads, unsubscribe: observer.subscribe(() => {}) };
}

describe("writeMovedCompletion", () => {
  const mine = residentDetail("me", "Eu", true);
  const moved = { ...mine, streak: 4 };

  async function run() {
    const client = createTestQueryClient();
    const watched = {
      plan: watch(client, dayPlanKey, {}),
      streak: watch(client, streakKey, 1),
      list: watch(client, residentsKey, []),
      mine: watch(client, residentKey("me"), mine),
      partner: watch(client, residentKey("r2"), residentDetail("r2", "Bruna")),
    };
    await settle();
    await writeMovedCompletion(client, moved);
    await settle();
    return { client, ...watched };
  }

  it("writes the answer into the caller's own detail", async () => {
    const { client } = await run();
    expect(client.getQueryData(residentKey("me"))).toEqual(moved);
  });

  it("reads the Day Plan, the Streak, the list and a partner's page again", async () => {
    const { plan, streak, list, partner } = await run();
    expect([plan.reads.count, streak.reads.count, list.reads.count, partner.reads.count]).toEqual([2, 2, 2, 2]);
  });

  it("does not read the detail it just wrote, so the server's answer is not replaced by an older one", async () => {
    const { mine } = await run();
    expect(mine.reads.count).toBe(1);
  });

  it("cancels a read of the detail that was already running", async () => {
    const client = createTestQueryClient();
    let finish!: () => void;
    const slow = client.fetchQuery({
      queryKey: residentKey("me"),
      queryFn: () => new Promise((resolve) => (finish = () => resolve(mine))),
    }).catch(() => undefined);
    await writeMovedCompletion(client, moved);
    finish();
    await slow;
    expect(client.getQueryData(residentKey("me"))).toEqual(moved);
  });
});
