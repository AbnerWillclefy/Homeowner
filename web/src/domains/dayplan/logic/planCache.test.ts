import { describe, expect, it } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { createTestQueryClient } from "../../../shared/query/testing";
import { dayPlanKey } from "../api/queries";
import { streakKey } from "../../streak/api/queries";
import { dayPlan } from "../testing/fixtures";
import { invalidateStreak, writeActionAnswer } from "./planCache";

const OLD = dayPlan({ energy: 3 });
const NEW = dayPlan({ energy: 8 });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("writeActionAnswer", () => {
  it("is not overwritten by a refetch that started before the action", async () => {
    const client = createTestQueryClient();
    const read = deferred<typeof OLD>();
    const refetch = client.fetchQuery({ queryKey: dayPlanKey, queryFn: () => read.promise }).catch(() => undefined);

    await writeActionAnswer(client, NEW);
    read.resolve(OLD);
    await refetch;

    expect(client.getQueryData(dayPlanKey)).toEqual(NEW);
  });

  it("is not overwritten by a refetch that started after the first cancel, in the middle of the action", async () => {
    const client = createTestQueryClient();
    await client.cancelQueries({ queryKey: dayPlanKey }); // the cancel before the call
    const read = deferred<typeof OLD>();
    // Window focus while the call runs.
    const refetch = client.fetchQuery({ queryKey: dayPlanKey, queryFn: () => read.promise }).catch(() => undefined);

    await writeActionAnswer(client, NEW); // the cancel again, then the write
    read.resolve(OLD);
    await refetch;

    expect(client.getQueryData(dayPlanKey)).toEqual(NEW);
  });

  it("replaces a cached plan when nothing is in flight", async () => {
    const client = createTestQueryClient();
    client.setQueryData(dayPlanKey, OLD);
    await writeActionAnswer(client, NEW);
    expect(client.getQueryData(dayPlanKey)).toEqual(NEW);
  });
});

describe("invalidateStreak", () => {
  it("reads the Streak again when something shows it", async () => {
    const client = createTestQueryClient();
    let reads = 0;
    const queryFn = async () => ++reads;
    const unsubscribe = new QueryObserver(client, { queryKey: streakKey, queryFn }).subscribe(() => undefined);
    await client.fetchQuery({ queryKey: streakKey, queryFn });
    expect(reads).toBe(1);

    await invalidateStreak(client);

    expect(reads).toBe(2);
    expect(client.getQueryData(streakKey)).toBe(2);
    unsubscribe();
  });

  it("marks an unused Streak invalid without reading it", async () => {
    const client = createTestQueryClient();
    client.setQueryData(streakKey, 1);
    await invalidateStreak(client);
    expect(client.getQueryState(streakKey)?.isInvalidated).toBe(true);
  });
});
