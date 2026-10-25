// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { resident } from "../testing/fixtures";
import type { ResidentsResult } from "../api/api";

const getResidents = vi.fn<() => Promise<ResidentsResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getResidents: () => getResidents(),
}));

const { residentsKey } = await import("../api/queries");
const { useResidents } = await import("./useResidents");

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
const LAUNCH = [resident("r1", "Ana")];
const FRESH = [resident("r1", "Ana"), resident("r2", "Bruna")];

describe("useResidents over the launch read", () => {
  let rendered: Rendered | undefined;
  let hook!: ReturnType<typeof useResidents>;
  const Probe = ({ hasHome }: { hasHome: boolean }) => {
    hook = useResidents(hasHome);
    return null;
  };
  beforeEach(() => getResidents.mockReset());
  afterEach(() => rendered?.unmount());

  it("does not read the list again when the Home arrives after the launch read succeeded", async () => {
    const client = createTestQueryClient();
    client.setQueryData(residentsKey, LAUNCH);
    rendered = renderWithQueryClient(createElement(Probe, { hasHome: false }), client);
    await settle();
    expect(getResidents).not.toHaveBeenCalled();

    // The Home answers: the Shell passes hasHome.
    rendered.rerender(createElement(Probe, { hasHome: true }));
    await settle();
    expect(getResidents).not.toHaveBeenCalled();
    expect(hook.state).toEqual({ kind: "ready", residents: LAUNCH });
  });

  it("reads the list when there is no cached one", async () => {
    getResidents.mockResolvedValue({ kind: "ok", date: "2030-01-15", residents: FRESH });
    const client = createTestQueryClient();
    rendered = renderWithQueryClient(createElement(Probe, { hasHome: false }), client);
    await settle();
    expect(getResidents).not.toHaveBeenCalled();

    rendered.rerender(createElement(Probe, { hasHome: true }));
    await settle();
    expect(getResidents).toHaveBeenCalledTimes(1);
    expect(hook.state).toEqual({ kind: "ready", residents: FRESH });
  });
});
