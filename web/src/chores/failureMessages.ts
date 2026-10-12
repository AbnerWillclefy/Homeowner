import type { Failure } from "./api";
import type { MessageKey } from "../i18n";

type Reason = Failure["kind"];

/** Shown when loading the Chores fails. A new failure kind fails the typecheck here until it has a message. */
export const LOAD_FAILURE_KEY: Record<Reason, MessageKey> = {
  offline: "chores.load.offline",
  error: "chores.load.error",
  "not-signed-in": "chores.notSignedIn",
};

/** Shown when saving a Chore fails. */
export const SAVE_FAILURE_KEY: Record<Reason | "gone", MessageKey> = {
  offline: "chores.form.save.offline",
  error: "chores.form.save.error",
  "not-signed-in": "chores.form.save.notSignedIn",
  gone: "chores.form.save.gone",
};

/** Shown when deleting a Chore fails. */
export const DELETE_FAILURE_KEY: Record<Reason, MessageKey> = {
  offline: "chores.delete.offline",
  error: "chores.delete.error",
  "not-signed-in": "chores.delete.notSignedIn",
};
