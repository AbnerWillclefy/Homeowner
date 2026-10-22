import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "./testing";
import { updateCached } from "./cacheUpdate";

const key = ["thing"] as const;
type Thing = { n: number };

describe("updateCached", () => {
  it("changes what the cache holds, from the newest value", () => {
    const client = createTestQueryClient();
    client.setQueryData(key, { n: 1 });
    updateCached(client, key, (v: Thing) => ({ n: v.n + 1 }));
    updateCached(client, key, (v: Thing) => ({ n: v.n + 1 }));
    expect(client.getQueryData(key)).toEqual({ n: 3 });
  });

  it("does nothing when the entry has no data yet", () => {
    const client = createTestQueryClient();
    updateCached(client, key, (v: Thing) => ({ n: v.n + 1 }));
    expect(client.getQueryData(key)).toBeUndefined();
  });

  it("cancels a read in flight, so its older answer cannot erase the change", async () => {
    const client = createTestQueryClient();
    client.setQueryData(key, { n: 1 });
    let answer!: (v: Thing) => void;
    const read = client
      .fetchQuery({ queryKey: key, queryFn: () => new Promise<Thing>((r) => (answer = r)), staleTime: 0 })
      .catch(() => undefined);
    updateCached(client, key, (v: Thing) => ({ n: v.n + 10 }));
    answer({ n: 1 });
    await read;
    expect(client.getQueryData(key)).toEqual({ n: 11 });
  });
});
