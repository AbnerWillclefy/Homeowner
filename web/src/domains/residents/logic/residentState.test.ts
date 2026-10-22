import { describe, expect, it } from "vitest";
import { residentDetail } from "../testing/fixtures";
import { residentStateOf } from "./residentState";

describe("residentStateOf", () => {
  const ANA = residentDetail("r1", "Ana");

  it("passes loading through", () => {
    expect(residentStateOf({ kind: "loading" })).toEqual({ kind: "loading" });
  });

  it("names a Resident as ready", () => {
    expect(residentStateOf({ kind: "ready", data: ANA })).toEqual({ kind: "ready", resident: ANA });
  });

  it("reads a null Resident as not-found", () => {
    expect(residentStateOf({ kind: "ready", data: null })).toEqual({ kind: "not-found" });
  });

  it.each([
    ["offline", "offline"],
    ["error", "error"],
    ["not-signed-in", "error"],
  ] as const)("a %s failure is failed with reason %s", (reason, expected) => {
    expect(residentStateOf({ kind: "failed", reason })).toEqual({ kind: "failed", reason: expected });
  });
});
