import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { IdsResult, ProfileResult } from "./api";
import type { OwnChoreSettingsResult } from "./choreSettingsApi";

const getCategories = vi.fn<() => Promise<IdsResult>>();
const getDemands = vi.fn<() => Promise<IdsResult>>();
const getProfile = vi.fn<() => Promise<ProfileResult>>();
const getOwnChoreSettings = vi.fn<() => Promise<OwnChoreSettingsResult>>();
vi.mock("./api", () => ({
  getCategories: () => getCategories(),
  getDemands: () => getDemands(),
  getProfile: () => getProfile(),
}));
vi.mock("./choreSettingsApi", () => ({ getOwnChoreSettings: () => getOwnChoreSettings() }));

const { categoriesKey, categoriesQuery, choreSettingsKey, choreSettingsQuery, demandsKey, demandsQuery, profileKey, profileQuery } =
  await import("./queries");

describe.each([
  ["categoriesQuery", categoriesKey, categoriesQuery, getCategories, ["categories"]],
  ["demandsQuery", demandsKey, demandsQuery, getDemands, ["demands"]],
] as const)("%s", (_name, key, anyQuery, call, path) => {
  // Both lists share one shape; the key literal is the only difference.
  const query = anyQuery as typeof categoriesQuery;
  beforeEach(() => call.mockReset());

  it("has a key shaped like the API path, outside the Home: the lists are the same for every Home", () => {
    expect(key).toEqual(path);
    expect(query.queryKey).toEqual(path);
  });

  it("returns the ids", async () => {
    call.mockResolvedValue({ kind: "ok", ids: ["a", "b"] });
    expect(await createTestQueryClient().fetchQuery(query)).toEqual(["a", "b"]);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    call.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(query).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});

const PROFILE = { baseline: { monday: 3 }, preferences: {}, restrictions: [] };
const SETTINGS = { c1: { preference: "like", restricted: false } };

describe.each([
  ["profileQuery", profileKey, profileQuery, getProfile, ["me", "profile"], { kind: "ok", profile: PROFILE }, PROFILE],
  [
    "choreSettingsQuery",
    choreSettingsKey,
    choreSettingsQuery,
    getOwnChoreSettings,
    ["home", "chores", "settings"],
    { kind: "ok", settings: SETTINGS },
    SETTINGS,
  ],
] as const)("%s", (_name, key, anyQuery, call, path, answer, data) => {
  const query = anyQuery as typeof profileQuery;
  const mock = call as ReturnType<typeof vi.fn>;
  beforeEach(() => mock.mockReset());

  it("has the expected key: the profile under me, the settings under the Home (so leaving a Home clears them)", () => {
    expect(key).toEqual(path);
    expect(query.queryKey).toEqual(path);
  });

  it("returns the data, without the result's kind", async () => {
    mock.mockResolvedValue(answer);
    expect(await createTestQueryClient().fetchQuery(query)).toEqual(data);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    mock.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(query).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
