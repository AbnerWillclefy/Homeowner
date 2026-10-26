import type { Translate } from "../../../shared/i18n/context";
import type { Level } from "../api/api";
import { LEVEL_KEYS } from "./labels";
import type { EnergyNote } from "./state";

/** What the pill is given: the Check-in read's outcome, and for a ready one the note from `energyNote`. */
export type PillInput =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "ready"; note: EnergyNote; energy: number | null; level: Level | null };

export type PillIcon = "none" | "zap" | "moon" | "check" | "alert";

export interface PillView {
  kind: "loading" | "failed" | EnergyNote;
  /** What the pill shows. Empty while loading. */
  text: string;
  /** The accessible name: the whole state in words, and what a tap does. */
  name: string;
  /** Only "no Check-in yet" has the dashed edge, and its text says so too. */
  dashed: boolean;
  icon: PillIcon;
}

/**
 * The Energy pill's wording, mapped from the one rule (`energyNote`), never re-derived: which note shows which text,
 * icon and name. `formatNumber` is the locale's number format. Colour and the edge never carry a state alone.
 */
export function energyPill(t: Translate, input: PillInput, formatNumber: (n: number) => string): PillView {
  if (input.kind === "loading") return { kind: "loading", text: "", name: "", dashed: false, icon: "none" };
  if (input.kind === "failed")
    return { kind: "failed", text: t("checkin.pill.failed"), name: t("checkin.pill.name.failed"), dashed: false, icon: "alert" };

  const { note, energy, level } = input;
  const number = formatNumber(energy ?? 0);
  switch (note) {
    case "unset":
      return { kind: note, text: t("checkin.pill.unset"), name: t("checkin.pill.name.unset"), dashed: true, icon: "none" };
    case "energy":
      return { kind: note, text: number, name: t("checkin.pill.name.energy", { energy: number }), dashed: false, icon: "zap" };
    case "drained":
      return { kind: note, text: formatNumber(0), name: t("checkin.pill.name.drained"), dashed: false, icon: "moon" };
    case "no-baseline":
      return { kind: note, text: formatNumber(0), name: t("checkin.pill.name.noBaseline"), dashed: false, icon: "zap" };
    case "pending": {
      if (level === null)
        return { kind: note, text: t("checkin.pill.unset"), name: t("checkin.pill.name.done"), dashed: false, icon: "check" };
      const label = t(LEVEL_KEYS[level].label);
      return { kind: note, text: label, name: t("checkin.pill.name.pending", { level: label }), dashed: false, icon: "check" };
    }
  }
}

/**
 * Every text the pill can show in this locale (the number is the current one), so the pill can stack them
 * invisibly and be as wide as the widest from the first frame, with no width written in pixels.
 */
export function pillWidthTexts(t: Translate, number: string): string[] {
  return [
    t("checkin.pill.unset"),
    t("checkin.pill.failed"),
    number,
    t(LEVEL_KEYS.low.label),
    t(LEVEL_KEYS.normal.label),
    t(LEVEL_KEYS.energized.label),
  ];
}
