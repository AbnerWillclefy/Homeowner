import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import { chore } from "../testing/fixtures";
import type { ListChoresResult } from "./api";

const listChores = vi.fn<() => Promise<ListChoresResult>>();
vi.mock("./api", () => ({ listChores: () => listChores() }));

const { choresKey, choresQuery } = await import("./queries");

const CHORES = [chore("a", "Dishes")];

describe("choresQuery", () => {
  beforeEach(() => listChores.mockReset());

  it("is keyed under the Home, so a join or leave clears it", () => {
    expect(choresKey).toEqual(["home", "chores"]);
    expect(choresQuery.queryKey).toEqual(["home", "chores"]);
  });

  it("returns the Chores", async () => {
    listChores.mockResolvedValue({ kind: "ok", chores: CHORES });
    expect(await createTestQueryClient().fetchQuery(choresQuery)).toEqual(CHORES);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    listChores.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(choresQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
