// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { chore } from "../testing/fixtures";
import type { ListChoresResult } from "../api/api";

const listChores = vi.fn<() => Promise<ListChoresResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listChores: () => listChores(),
}));
const getCategories = vi.fn();
const getDemands = vi.fn();
vi.mock("../../profile/api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCategories: () => getCategories(),
  getDemands: () => getDemands(),
}));

const { choresKey } = await import("../api/queries");
const { categoriesKey, demandsKey } = await import("../../profile/api/queries");
const { useChores } = await import("./useChores");

const CACHED = [chore("a", "Dishes")];
const FRESH = [chore("a", "Dishes"), chore("b", "Trash")];

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useChores over the query cache", () => {
  let rendered: Rendered | undefined;
  let hook!: ReturnType<typeof useChores>;
  const Probe = () => {
    hook = useChores();
    return null;
  };
  const mount = (seed: boolean) => {
    const client = createTestQueryClient();
    if (seed) {
      client.setQueryData(choresKey, CACHED);
      client.setQueryData(categoriesKey, ["kitchen"]);
      client.setQueryData(demandsKey, ["heavy"]);
    }
    rendered = renderWithQueryClient(createElement(Probe), client);
    return client;
  };
  beforeEach(() => {
    listChores.mockReset();
    getCategories.mockReset().mockResolvedValue({ kind: "ok", ids: ["kitchen"] });
    getDemands.mockReset().mockResolvedValue({ kind: "ok", ids: ["heavy"] });
  });
  afterEach(() => rendered?.unmount());

  it("loads on first visit, then is ready with all three", async () => {
    listChores.mockResolvedValue({ kind: "ok", chores: CACHED });
    mount(false);
    expect(hook.state).toEqual({ kind: "loading" });
    await settle();
    expect(hook.state).toEqual({ kind: "ready", chores: CACHED, categories: ["kitchen"], demands: ["heavy"] });
  });

  it("shows the cached lists at once while a refetch runs behind them", async () => {
    let answer!: (result: ListChoresResult) => void;
    listChores.mockImplementation(() => new Promise<ListChoresResult>((resolve) => (answer = resolve)));
    mount(true);
    expect(hook.state.kind).toBe("ready");
    expect(hook.refreshing).toBe(true);
    answer({ kind: "ok", chores: FRESH });
    await settle();
    expect(hook.state).toMatchObject({ kind: "ready", chores: FRESH });
    expect(hook.refreshing).toBe(false);
  });

  it("keeps the cached lists, with no failed state, when the refetch fails", async () => {
    listChores.mockResolvedValue({ kind: "offline" });
    mount(true);
    await settle();
    expect(hook.state).toMatchObject({ kind: "ready", chores: CACHED });
  });

  it("fails on a first load with the first failure in order", async () => {
    getDemands.mockResolvedValue({ kind: "error" });
    listChores.mockResolvedValue({ kind: "offline" });
    mount(false);
    await settle();
    expect(hook.state).toEqual({ kind: "failed", reason: "error" });
  });

  it("shows a saved and a removed Chore without reading the list again", async () => {
    listChores.mockResolvedValue({ kind: "ok", chores: CACHED });
    mount(false);
    await settle();
    await act(async () => hook.upsert(chore("b", "Trash")));
    await settle();
    expect(hook.state).toMatchObject({ kind: "ready", chores: FRESH });
    await act(async () => hook.remove("a"));
    await settle();
    expect(hook.state).toMatchObject({ kind: "ready", chores: [chore("b", "Trash")] });
    expect(listChores).toHaveBeenCalledTimes(1);
  });
});
