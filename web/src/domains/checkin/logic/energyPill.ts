import type { Translate } from "../../../shared/i18n/context";
import type { Level } from "../api/api";
import { LEVEL_KEYS } from "./labels";
import type { CheckInState, EnergyNote } from "./state";

/** What the pill is given: the Check-in read's outcome, and for a ready one the note from `energyNote`. */
export type PillInput =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; note: EnergyNote; energy: number | null; level: Level | null };

/**
 * What the pill is given from the Check-in read: nothing before the Home is ready (the slot stays empty), `loading`
 * while it reads, `failed` after a failure, and `ready` once the Check-in and its note are known.
 */
export function pillInput(args: {
  checkInState: CheckInState;
  note: EnergyNote | null;
  energy: number | null;
  homeReady: boolean;
}): PillInput | null {
  const { checkInState, note, energy, homeReady } = args;
  if (checkInState.kind === "failed") return { kind: "failed" };
  if (checkInState.kind === "ready" && note !== null) return { kind: "ready", note, energy, level: checkInState.checkIn.level };
  return homeReady ? { kind: "loading" } : null;
}

// Symbols, not words, so they are not catalog keys. The accessible name carries the meaning.
const UNKNOWN = "?";
const DASH = "–";

export type PillIcon = "zap" | "moon" | "check" | "alert";

export interface PillView {
  kind: "failed" | EnergyNote;
  /** What the indicator shows: a short number or symbol, never a word. */
  text: string;
  /** The accessible name: the whole state in words, and what a tap does. */
  name: string;
  /** Only "no Check-in yet" is muted (Lichen); the "?" and the name say so too. */
  muted: boolean;
  icon: PillIcon;
}

// shortcut: the fixed `min-w-16` slot assumes Energy stays at most two digits (cap 20); bring back a width stack if the cap passes 99.
/**
 * The Energy indicator's wording, mapped from the one rule (`energyNote`), never re-derived: which note shows which
 * text, icon and name. `formatNumber` is the locale's number format. Colour never carries a state alone.
 */
export function energyPill(t: Translate, input: Exclude<PillInput, { kind: "loading" }>, formatNumber: (n: number) => string): PillView {
  if (input.kind === "failed") return { kind: "failed", text: DASH, name: t("checkin.pill.name.failed"), muted: false, icon: "alert" };

  const { note, energy, level } = input;
  const number = formatNumber(energy ?? 0);
  switch (note) {
    case "unset":
      return { kind: note, text: UNKNOWN, name: t("checkin.pill.name.unset"), muted: true, icon: "zap" };
    case "energy":
      return { kind: note, text: number, name: t("checkin.pill.name.energy", { energy: number }), muted: false, icon: "zap" };
    case "drained":
      return { kind: note, text: formatNumber(0), name: t("checkin.pill.name.drained"), muted: false, icon: "moon" };
    case "no-baseline":
      return { kind: note, text: formatNumber(0), name: t("checkin.pill.name.noBaseline"), muted: false, icon: "zap" };
    case "pending": {
      // No number yet, so a check mark and a dash; the name has the level.
      const name = level === null ? t("checkin.pill.name.done") : t("checkin.pill.name.pending", { level: t(LEVEL_KEYS[level].label) });
      return { kind: note, text: DASH, name, muted: false, icon: "check" };
    }
  }
}
