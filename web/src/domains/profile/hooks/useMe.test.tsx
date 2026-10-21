// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeResult } from "../../auth/api/meApi";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";

const getMe = vi.fn<() => Promise<MeResult>>();
vi.mock("../../auth/api/meApi", () => ({ getMe: () => getMe() }));

const { meKey, meQuery } = await import("../../auth/api/queries");
const { useMe } = await import("./useMe");

const OLD = { id: "u1", email: "a@b.c", displayName: null, name: "Old", photoUrl: null, initials: "O", avatarTone: "kitchen" } as const;
const NEW = { ...OLD, name: "New", initials: "N" };

describe("useMe", () => {
  let rendered: Rendered | undefined;
  beforeEach(() => {
    getMe.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("set keeps the saved User when a read that started earlier answers afterwards", async () => {
    let answerOld!: (result: MeResult) => void;
    getMe.mockImplementation(() => new Promise<MeResult>((resolve) => (answerOld = resolve)));
    let me!: ReturnType<typeof useMe>;
    const Probe = () => {
      me = useMe();
      return null;
    };
    const client = createTestQueryClient();
    client.setQueryData(meKey, OLD);
    rendered = renderWithQueryClient(createElement(Probe), client);
    void client.fetchQuery({ ...meQuery, staleTime: 0 }).catch(() => undefined);
    await act(async () => {
      await me.set(NEW);
    });
    await act(async () => answerOld({ kind: "ok", ...OLD }));
    expect(client.getQueryData(meKey)).toEqual(NEW);
  });
});
