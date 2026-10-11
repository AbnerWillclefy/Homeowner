import { createHome, getHome, updateHome, type FieldCodes, type Home, type HomeSettings } from "../api/home";

export type SaveOutcome =
  /** `recovered`: the create was refused because a Home already existed, and that Home was loaded. */
  | { kind: "ok"; home: Home; recovered: boolean }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: "not-signed-in" }
  | { kind: "offline" }
  | { kind: "error" };

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
): Promise<SaveOutcome> {
  const created = await deps.createHome(settings);
  if (created.kind === "ok") return { kind: "ok", home: created.home, recovered: false };
  if (created.kind !== "already-resident") return created;

  const loaded = await deps.getHome();
  if (loaded.kind === "ok") return { kind: "ok", home: loaded.home, recovered: true };
  // A Home that was there a moment ago and is not now: nothing sensible to show but a retry.
  if (loaded.kind === "none") return { kind: "error" };
  return loaded;
}

/** Saves edits to the Home's settings. A Home that has vanished leaves nothing to show but a retry. */
export async function saveSettings(
  settings: HomeSettings,
  update: typeof updateHome = updateHome,
): Promise<SaveOutcome> {
  const result = await update(settings);
  if (result.kind === "ok") return { kind: "ok", home: result.home, recovered: false };
  if (result.kind === "none") return { kind: "error" };
  return result;
}
