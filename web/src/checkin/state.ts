import type { CheckIn, Failure, Level } from "../api/checkIn";

/** Why a save did not go through. `invalid` is the API refusing values the form should never send. */
export type SaveFailure = Failure["kind"] | "invalid" | "none";

export type CheckInState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] | "none" }
  | {
      kind: "ready";
      checkIn: CheckIn;
      /** The person pressed Change on a Check-in that exists. */
      editing: boolean;
      saving: boolean;
      saveFailure: SaveFailure | null;
      /** The last save went through; shown until the next change. */
      saved: boolean;
    };

export type CheckInAction =
  | { type: "load" }
  | { type: "loaded"; checkIn: CheckIn }
  | { type: "load-failed"; reason: Failure["kind"] | "none" }
  | { type: "edit" }
  | { type: "cancel" }
  | { type: "save-started" }
  | { type: "saved"; checkIn: CheckIn }
  | { type: "save-failed"; reason: SaveFailure };

export function checkInReducer(state: CheckInState, action: CheckInAction): CheckInState {
  switch (action.type) {
    case "load":
      return { kind: "loading" };
    case "loaded":
      return { kind: "ready", checkIn: action.checkIn, editing: false, saving: false, saveFailure: null, saved: false };
    case "load-failed":
      return { kind: "failed", reason: action.reason };
  }
  if (state.kind !== "ready") return state;
  switch (action.type) {
    case "edit":
      return { ...state, editing: true, saved: false, saveFailure: null };
    case "cancel":
      return { ...state, editing: false, saveFailure: null };
    case "save-started":
      return { ...state, saving: true, saveFailure: null, saved: false };
    case "saved":
      return { kind: "ready", checkIn: action.checkIn, editing: false, saving: false, saveFailure: null, saved: true };
    case "save-failed":
      return { ...state, saving: false, saveFailure: action.reason };
  }
}

export type CheckInView = "loading" | "failed" | "prompt" | "change" | "summary";

/**
 * What the section shows. The prompt appears exactly when today's Check-in is missing, and nothing is kept
 * about it being skipped, so it comes back on every open.
 */
export function checkInView(state: CheckInState): CheckInView {
  if (state.kind !== "ready") return state.kind;
  if (!state.checkIn.checkedIn) return "prompt";
  return state.editing ? "change" : "summary";
}

/** Which line the Today section shows about the Resident's Energy. */
export type EnergyNote = "energy" | "no-baseline" | "drained";

export function energyNote(energy: number | null, level: Level | null): EnergyNote {
  if (energy !== null && energy > 0) return "energy";
  return level === "drained" ? "drained" : "no-baseline";
}
