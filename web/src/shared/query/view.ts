import { ApiFailure, type ApiFailureKind } from "./ApiFailure";

/** The part of a query result that `viewOf` reads, so it is testable without React. */
export interface QuerySnapshot<T> {
  data: T | undefined;
  error: unknown;
  isFetching: boolean;
}

export type QueryViewState<T> =
  | { kind: "loading" }
  | { kind: "failed"; reason: ApiFailureKind }
  | { kind: "ready"; data: T };

export interface QueryView<T> {
  state: QueryViewState<T>;
  /** A read is running over data that is already on screen: show the quiet indicator, never a skeleton. */
  refreshing: boolean;
}

/**
 * One view state from a query, for every hook that reads the server.
 * - Data present is `ready`, even when a later refetch failed: the data stays and no alert shows.
 * - No data with no error, or with a refetch running (first load, Retry, disabled query), is `loading`.
 * - No data, an error and nothing running is `failed`, with the `ApiFailure` kind (`"error"` for anything else).
 * `null` is data: a `none` answer is ready.
 */
export function viewOf<T>({ data, error, isFetching }: QuerySnapshot<T>): QueryView<T> {
  if (data !== undefined) return { state: { kind: "ready", data }, refreshing: isFetching };
  if (error === null || error === undefined || isFetching) return { state: { kind: "loading" }, refreshing: false };
  return { state: { kind: "failed", reason: error instanceof ApiFailure ? error.kind : "error" }, refreshing: false };
}
