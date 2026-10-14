import type { ChoreWire } from "../../chores/api/api";
import {
  createHome,
  getHome,
  updateHome,
  type CreateHomeResult,
  type Home,
  type HomeSettings,
  type UpdateHomeResult,
} from "../api/api";

/** A create's result: `recovered` stands in for `already-resident` once that Home has been loaded. */
export type CreateOutcome = Exclude<CreateHomeResult, { kind: "already-resident" }> | { kind: "recovered"; home: Home };

/** An edit's result: a Home that has vanished is reported as an `error`. */
export type SaveResult = Exclude<UpdateHomeResult, { kind: "none" }>;

interface Deps {
  createHome: typeof createHome;
  getHome: typeof getHome;
}

/**
 * Creates the Home. A 409 means the person already lives in one (another device, or a double tap that
 * got through), so the way out is to load that Home rather than show a failure.
 */
export async function createOrLoad(
  settings: HomeSettings,
  deps: Deps = { createHome, getHome },
  /** The reviewed Chores to create with the Home. After a 409 they are not added: the Home already exists. */
  chores: readonly ChoreWire[] = [],
): Promise<CreateOutcome> {
  const created = await deps.createHome(settings, chores);
  if (created.kind !== "already-resident") return created;

  const loaded = await deps.getHome();
  if (loaded.kind === "ok") return { kind: "recovered", home: loaded.home };
  // A Home that was there a moment ago and is not now: nothing sensible to show but a retry.
  if (loaded.kind === "none") return { kind: "error" };
  return loaded;
}

/** Saves edits to the Home's settings. A Home that has vanished leaves nothing to show but a retry. */
export async function saveSettings(settings: HomeSettings, update: typeof updateHome = updateHome): Promise<SaveResult> {
  const result = await update(settings);
  return result.kind === "none" ? { kind: "error" } : result;
}
