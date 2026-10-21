export type ApiFailureKind = "offline" | "error" | "not-signed-in";

/** What a React Query `queryFn` throws when an API call fails, so the query lands in its error state with a kind the screen can read. */
export class ApiFailure extends Error {
  readonly kind: ApiFailureKind;

  constructor(kind: ApiFailureKind) {
    super(kind);
    this.name = "ApiFailure";
    this.kind = kind;
  }
}

type Okay = { kind: "ok" };
type None = { kind: "none" };
type Failed = { kind: ApiFailureKind };

/** Null is part of the data only when the result type can be `none`. */
type QueryData<R> = [Extract<R, None>] extends [never] ? Extract<R, Okay> : Extract<R, Okay> | null;

/**
 * Turns an API module result into query data: the ok result itself, null for none, and a thrown
 * ApiFailure for offline, error and not-signed-in. Use it in every `queryFn`.
 */
export function toQueryData<R extends Okay | None | Failed>(result: R): QueryData<R> {
  if (isOkay(result)) return result as QueryData<R>;
  if (result.kind === "none") return null as QueryData<R>;
  throw new ApiFailure((result as Failed).kind);
}

function isOkay<R extends Okay | None | Failed>(result: R): result is Extract<R, Okay> {
  return result.kind === "ok";
}
