import type { Translate } from "../i18n";

/** The interval choices in the Chore form. Custom is every other interval, including none (a one-off Chore). */
export const INTERVAL_PRESETS = ["daily", "weekly", "every_2_weeks", "monthly"] as const;

export type NamedPreset = (typeof INTERVAL_PRESETS)[number];
export type IntervalPreset = NamedPreset | "custom";

// The schedule counts days (ADR 0001), so a calendar month cannot be stored: Monthly is 30 days.
const DAYS: Record<NamedPreset, number> = { daily: 1, weekly: 7, every_2_weeks: 14, monthly: 30 };

/** The preset whose days match exactly; custom for a one-off (null) and every other number. */
export function presetFor(intervalDays: number | null): IntervalPreset {
  return INTERVAL_PRESETS.find((preset) => DAYS[preset] === intervalDays) ?? "custom";
}

/** The days a named preset stands for; null for custom, which is whatever is typed (blank is a one-off). */
export function intervalForPreset(preset: IntervalPreset): number | null {
  return preset === "custom" ? null : DAYS[preset];
}

/** The words for a Chore's repeat: one-off, every N days for custom, otherwise the preset's name. */
export function intervalText(t: Translate, intervalDays: number | null): string {
  if (intervalDays === null) return t("chores.item.once");
  const preset = presetFor(intervalDays);
  if (preset === "custom") return t("chores.item.every", { days: intervalDays });
  return preset === "daily" ? t("chores.item.daily") : t(`chores.interval.${preset}`);
}

/** The preset for the form's interval text. */
export function presetForText(text: string): IntervalPreset {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? presetFor(Number(trimmed)) : "custom";
}
