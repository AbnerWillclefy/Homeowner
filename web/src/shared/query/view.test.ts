import { describe, expect, it } from "vitest";
import { ApiFailure } from "./ApiFailure";
import { viewOf } from "./view";

describe("viewOf", () => {
  it("is loading on the first load: no data, no error, fetching", () => {
    expect(viewOf({ data: undefined, error: null, isFetching: true })).toEqual({ state: { kind: "loading" }, refreshing: false });
  });

  it("is loading for a disabled query: no data, no error, not fetching", () => {
    expect(viewOf({ data: undefined, error: null, isFetching: false })).toEqual({ state: { kind: "loading" }, refreshing: false });
  });

  it("is loading on a Retry after a failure: no data, an error left over, fetching", () => {
    expect(viewOf({ data: undefined, error: new ApiFailure("offline"), isFetching: true })).toEqual({
      state: { kind: "loading" },
      refreshing: false,
    });
  });

  it("is failed with the failure kind when nothing is running and there is no data", () => {
    expect(viewOf({ data: undefined, error: new ApiFailure("not-signed-in"), isFetching: false })).toEqual({
      state: { kind: "failed", reason: "not-signed-in" },
      refreshing: false,
    });
  });

  it("is failed with kind error for a thrown value that is not an ApiFailure", () => {
    expect(viewOf({ data: undefined, error: new TypeError("boom"), isFetching: false }).state).toEqual({ kind: "failed", reason: "error" });
  });

  it("is ready with the data when settled", () => {
    expect(viewOf({ data: { id: 1 }, error: null, isFetching: false })).toEqual({
      state: { kind: "ready", data: { id: 1 } },
      refreshing: false,
    });
  });

  it("is ready and refreshing while a refetch runs over data", () => {
    expect(viewOf({ data: "x", error: null, isFetching: true })).toEqual({ state: { kind: "ready", data: "x" }, refreshing: true });
  });

  it("stays ready when a refetch failed: the data stays and no alert shows", () => {
    expect(viewOf({ data: "x", error: new ApiFailure("offline"), isFetching: false })).toEqual({
      state: { kind: "ready", data: "x" },
      refreshing: false,
    });
  });

  it("counts null as data: a Home that is none is ready, not loading", () => {
    expect(viewOf({ data: null, error: null, isFetching: false })).toEqual({ state: { kind: "ready", data: null }, refreshing: false });
  });
});
