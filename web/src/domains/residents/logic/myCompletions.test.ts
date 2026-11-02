import { describe, expect, it } from "vitest";
import type { ResidentsState } from "../hooks/useResidents";
import { residentDetail, resident } from "../testing/fixtures";
import { myCompletionsStateOf, myResidentId } from "./myCompletions";

const me = { ...resident("r2", "Bruna"), you: true };
const ready: ResidentsState = { kind: "ready", residents: [resident("r1", "Ana"), me] };
const detail = residentDetail("r2", "Bruna", true);

describe("myResidentId", () => {
  it("is the id of the row marked as you", () => {
    expect(myResidentId(ready)).toBe("r2");
  });

  it("is undefined while the list loads, after it fails and when no row is you", () => {
    expect(myResidentId({ kind: "loading" })).toBeUndefined();
    expect(myResidentId({ kind: "failed" })).toBeUndefined();
    expect(myResidentId({ kind: "ready", residents: [resident("r1", "Ana")] })).toBeUndefined();
  });
});

describe("myCompletionsStateOf", () => {
  it("is loading while the list loads, whatever the detail says", () => {
    expect(myCompletionsStateOf({ kind: "loading" }, { kind: "loading" })).toEqual({ kind: "loading" });
  });

  it("is loading while the detail loads", () => {
    expect(myCompletionsStateOf(ready, { kind: "loading" })).toEqual({ kind: "loading" });
  });

  it("is ready with the detail", () => {
    expect(myCompletionsStateOf(ready, { kind: "ready", resident: detail })).toEqual({ kind: "ready", detail });
  });

  it("fails with a retry of the list when the list failed, never an empty state", () => {
    expect(myCompletionsStateOf({ kind: "failed" }, { kind: "loading" })).toEqual({ kind: "failed", retry: "list" });
  });

  it("fails with a retry of the list when the list has no row for you", () => {
    expect(myCompletionsStateOf({ kind: "ready", residents: [] }, { kind: "loading" })).toEqual({ kind: "failed", retry: "list" });
  });

  it("fails with a retry of the detail when the detail failed or is not found", () => {
    expect(myCompletionsStateOf(ready, { kind: "failed", reason: "error" })).toEqual({ kind: "failed", retry: "detail" });
    expect(myCompletionsStateOf(ready, { kind: "not-found" })).toEqual({ kind: "failed", retry: "detail" });
  });
});
