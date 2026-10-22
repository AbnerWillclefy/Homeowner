// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { resident, residentDetail } from "../testing/fixtures";
import type { ResidentResult, ResidentsResult } from "../api/api";

const getResident = vi.fn<(id: string) => Promise<ResidentResult>>();
const getResidents = vi.fn<() => Promise<ResidentsResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getResident: (id: string) => getResident(id),
  getResidents: () => getResidents(),
}));

const { residentKey, residentsKey } = await import("../api/queries");
const { useResident } = await import("./useResident");
const { useResidents } = await import("./useResidents");

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
const ANA = residentDetail("r1", "Ana");
const BRUNA = residentDetail("r2", "Bruna");

describe("useResident over the query cache", () => {
  let rendered: Rendered | undefined;
  let hook!: ReturnType<typeof useResident>;
  let setId!: (id: string) => void;
  const Probe = ({ first }: { first: string }) => {
    const [id, set] = useState(first);
    setId = set;
    hook = useResident(id);
    return null;
  };
  /** Mounts the hook for `id`, with Ana's page already in the cache. */
  const mount = (id: string) => {
    const client = createTestQueryClient();
    client.setQueryData(residentKey("r1"), ANA);
    rendered = renderWithQueryClient(createElement(Probe, { first: id }), client);
    return client;
  };
  beforeEach(() => {
    getResident.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("loads on a first visit, with the skeleton state", async () => {
    getResident.mockResolvedValue({ kind: "ok", resident: BRUNA });
    mount("r2");
    expect(hook.state).toEqual({ kind: "loading" });
    expect(hook.refreshing).toBe(false);
    await settle();
    expect(hook.state).toEqual({ kind: "ready", resident: BRUNA });
  });

  it("shows a visited page at once while a refetch runs behind it", async () => {
    let answer!: (result: ResidentResult) => void;
    getResident.mockImplementation(() => new Promise<ResidentResult>((resolve) => (answer = resolve)));
    mount("r1");
    expect(hook.state).toEqual({ kind: "ready", resident: ANA });
    expect(hook.refreshing).toBe(true);
    answer({ kind: "ok", resident: { ...ANA, streak: 9 } });
    await settle();
    expect(hook.state).toMatchObject({ kind: "ready", resident: { streak: 9 } });
    expect(hook.refreshing).toBe(false);
  });

  it("keeps the cached page, with no failed state, when the refetch fails", async () => {
    getResident.mockResolvedValue({ kind: "offline" });
    mount("r1");
    await settle();
    expect(hook.state).toEqual({ kind: "ready", resident: ANA });
  });

  it("on an id change shows loading, never the old person under the new name", async () => {
    getResident.mockResolvedValue({ kind: "ok", resident: BRUNA });
    mount("r1");
    expect(hook.state).toEqual({ kind: "ready", resident: ANA });
    act(() => setId("r2"));
    expect(hook.state).toEqual({ kind: "loading" });
    await settle();
    expect(hook.state).toEqual({ kind: "ready", resident: BRUNA });
  });

  it("reads not-found and none as not-found", async () => {
    getResident.mockResolvedValue({ kind: "not-found" });
    mount("nobody");
    await settle();
    expect(hook.state).toEqual({ kind: "not-found" });
  });

  it.each([
    ["offline", "offline"],
    ["error", "error"],
    ["not-signed-in", "error"],
  ] as const)("a first-load %s is failed with reason %s, and retry loads again", async (kind, reason) => {
    getResident.mockResolvedValueOnce({ kind });
    mount("nobody");
    await settle();
    expect(hook.state).toEqual({ kind: "failed", reason });
    getResident.mockResolvedValue({ kind: "ok", resident: BRUNA });
    await act(async () => hook.retry());
    await settle();
    expect(hook.state).toEqual({ kind: "ready", resident: BRUNA });
  });
});

describe("useResidents over the query cache", () => {
  let rendered: Rendered | undefined;
  let hook!: ReturnType<typeof useResidents>;
  const LIST = [resident("r1", "Ana")];
  const mount = (hasHome: boolean, seed: boolean) => {
    const client = createTestQueryClient();
    if (seed) client.setQueryData(residentsKey, LIST);
    rendered = renderWithQueryClient(
      createElement(() => {
        hook = useResidents(hasHome);
        return null;
      }),
      client,
    );
    return client;
  };
  beforeEach(() => {
    getResidents.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("is loading and reads nothing while there is no Home", async () => {
    mount(false, false);
    await settle();
    expect(hook.state).toEqual({ kind: "loading" });
    expect(getResidents).not.toHaveBeenCalled();
  });

  it("loads once there is a Home and joins by id", async () => {
    getResidents.mockResolvedValue({ kind: "ok", date: "2030-01-15", residents: LIST });
    mount(true, false);
    expect(hook.state).toEqual({ kind: "loading" });
    await settle();
    expect(hook.state).toEqual({ kind: "ready", residents: LIST });
    expect(hook.byResidentId("r1")).toEqual(LIST[0]);
    expect(hook.byResidentId("nope")).toBeUndefined();
  });

  it("fails on a first-load failure", async () => {
    getResidents.mockResolvedValue({ kind: "error" });
    mount(true, false);
    await settle();
    expect(hook.state).toEqual({ kind: "failed" });
    expect(hook.byResidentId("r1")).toBeUndefined();
  });

  it("reload reads again and keeps the list on screen meanwhile", async () => {
    getResidents.mockResolvedValue({ kind: "ok", date: "2030-01-15", residents: LIST });
    mount(true, true);
    await settle();
    let answer!: (result: ResidentsResult) => void;
    getResidents.mockImplementation(() => new Promise<ResidentsResult>((resolve) => (answer = resolve)));
    await act(async () => hook.reload());
    expect(hook.state).toEqual({ kind: "ready", residents: LIST });
    const renamed = [resident("r1", "Ana Maria")];
    answer({ kind: "ok", date: "2030-01-15", residents: renamed });
    await settle();
    expect(hook.state).toEqual({ kind: "ready", residents: renamed });
  });
});
