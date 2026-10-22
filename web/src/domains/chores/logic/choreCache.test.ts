import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../shared/query/testing";
import { categoriesKey } from "../../profile/api/queries";
import type { Chore } from "../api/api";
import { choresKey } from "../api/queries";
import { chore } from "../testing/fixtures";
import { removeChoreFromCache, saveChoreInCache } from "./choreCache";

const SEEDED = [chore("a", "Dishes"), chore("b", "Trash")];

function seeded() {
  const client = createTestQueryClient();
  client.setQueryData(choresKey, SEEDED);
  client.setQueryData(categoriesKey, ["kitchen"]);
  return client;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("saveChoreInCache", () => {
  it("adds a created Chore and leaves the Categories alone", async () => {
    const client = seeded();
    await saveChoreInCache(client, chore("c", "Floors"));
    expect(client.getQueryData<Chore[]>(choresKey)?.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(client.getQueryData(categoriesKey)).toEqual(["kitchen"]);
  });

  it("replaces an edited Chore in place", async () => {
    const client = seeded();
    await saveChoreInCache(client, chore("a", "Wash dishes"));
    expect(client.getQueryData<Chore[]>(choresKey)?.map((c) => c.name)).toEqual(["Wash dishes", "Trash"]);
  });

  it("writes nothing when the list was never loaded", async () => {
    const client = createTestQueryClient();
    await saveChoreInCache(client, chore("c", "Floors"));
    expect(client.getQueryData(choresKey)).toBeUndefined();
  });

  it("is not overwritten by a read that started before the save", async () => {
    const client = seeded();
    const read = deferred<Chore[]>();
    const refetch = client.fetchQuery({ queryKey: choresKey, queryFn: () => read.promise, staleTime: 0 }).catch(() => undefined);
    await saveChoreInCache(client, chore("c", "Floors"));
    read.resolve(SEEDED);
    await refetch;
    expect(client.getQueryData<Chore[]>(choresKey)?.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("removeChoreFromCache", () => {
  it("drops the Chore and leaves the Categories alone", async () => {
    const client = seeded();
    await removeChoreFromCache(client, "a");
    expect(client.getQueryData<Chore[]>(choresKey)?.map((c) => c.id)).toEqual(["b"]);
    expect(client.getQueryData(categoriesKey)).toEqual(["kitchen"]);
  });
});

describe("the chores key", () => {
  it("also matches a deeper key under it, so a partial key reaches Chore settings", () => {
    const client = seeded();
    client.setQueryData([...choresKey, "settings"], { x: 1 });
    expect(client.getQueryCache().findAll({ queryKey: choresKey })).toHaveLength(2);
  });
});
