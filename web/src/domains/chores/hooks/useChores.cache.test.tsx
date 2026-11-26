// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { chore } from "../testing/fixtures";
import type { DeleteChoreResult, ListChoresResult } from "../api/api";
import { undoHarness } from "../../../shared/undo/testing";

const listChores = vi.fn<() => Promise<ListChoresResult>>();
const deleteChore = vi.fn<(id: string) => Promise<DeleteChoreResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listChores: () => listChores(),
  deleteChore: (id: string) => deleteChore(id),
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
  let undo = undoHarness();
  const mount = (seed: boolean) => {
    undo = undoHarness();
    const client = createTestQueryClient();
    if (seed) {
      client.setQueryData(choresKey, CACHED);
      client.setQueryData(categoriesKey, ["kitchen"]);
      client.setQueryData(demandsKey, ["heavy"]);
    }
    rendered = renderWithQueryClient(undo.wrap(createElement(Probe)), client);
    return client;
  };
  beforeEach(() => {
    listChores.mockReset();
    deleteChore.mockReset().mockResolvedValue({ kind: "ok" });
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

  it("shows a saved Chore without reading the list again", async () => {
    listChores.mockResolvedValue({ kind: "ok", chores: CACHED });
    mount(false);
    await settle();
    await act(async () => hook.upsert(chore("b", "Trash")));
    await settle();
    expect(hook.state).toMatchObject({ kind: "ready", chores: FRESH });
    expect(listChores).toHaveBeenCalledTimes(1);
  });

  describe("an undoable delete", () => {
    const FRESH_AB = [chore("a", "Dishes"), chore("b", "Trash")];
    const stateChores = () => (hook.state.kind === "ready" ? hook.state.chores.map((c) => c.id) : null);

    it("hides the row at once, sends nothing while held, and survives a refetch", async () => {
      listChores.mockResolvedValue({ kind: "ok", chores: FRESH_AB });
      const client = mount(false);
      await settle();
      await act(async () => hook.destroy(FRESH_AB[0]!));
      expect(stateChores()).toEqual(["b"]);
      expect(undo.toasts[0]!.request).toMatchObject({ messageKey: "chores.undo.delete", params: { name: "Dishes" } });
      expect(deleteChore).not.toHaveBeenCalled();
      await act(async () => void (await client.refetchQueries({ queryKey: choresKey })));
      await settle();
      expect(listChores).toHaveBeenCalledTimes(2);
      expect(stateChores()).toEqual(["b"]);
      expect(deleteChore).not.toHaveBeenCalled();
    });

    it("brings the row back and sends nothing when Desfazer is tapped", async () => {
      listChores.mockResolvedValue({ kind: "ok", chores: FRESH_AB });
      mount(false);
      await settle();
      await act(async () => hook.destroy(FRESH_AB[0]!));
      await act(async () => undo.undo(0));
      await act(async () => undo.close(0));
      await settle();
      expect(stateChores()).toEqual(["a", "b"]);
      expect(deleteChore).not.toHaveBeenCalled();
    });

    it("sends one DELETE when the Toast closes, then drops the Chore from the cache", async () => {
      listChores.mockResolvedValue({ kind: "ok", chores: FRESH_AB });
      mount(false);
      await settle();
      await act(async () => hook.destroy(FRESH_AB[0]!));
      await act(async () => undo.close(0));
      await settle();
      expect(deleteChore).toHaveBeenCalledExactlyOnceWith("a");
      expect(stateChores()).toEqual(["b"]);
      expect(listChores).toHaveBeenCalledTimes(1);
    });

    it("treats a Chore already gone elsewhere as deleted", async () => {
      deleteChore.mockResolvedValue({ kind: "none" });
      listChores.mockResolvedValue({ kind: "ok", chores: FRESH_AB });
      mount(false);
      await settle();
      await act(async () => hook.destroy(FRESH_AB[0]!));
      await act(async () => undo.close(0));
      await settle();
      expect(stateChores()).toEqual(["b"]);
      expect(undo.toasts.filter((toast) => toast.request.tone === "error")).toHaveLength(0);
    });

    it("shows the row again and an error Toast when the DELETE fails", async () => {
      deleteChore.mockResolvedValue({ kind: "offline" });
      listChores.mockResolvedValue({ kind: "ok", chores: FRESH_AB });
      mount(false);
      await settle();
      await act(async () => hook.destroy(FRESH_AB[0]!));
      await act(async () => undo.close(0));
      await settle();
      expect(stateChores()).toEqual(["a", "b"]);
      expect(undo.toasts.at(-1)!.request).toMatchObject({ tone: "error", messageKey: "chores.delete.offline" });
    });
  });
});
