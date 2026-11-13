import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { GoalInput } from "../api";

export type FormResult<T> = ({ ok: true } & T) | { ok: false; errors: Record<string, string> };

const MAX_NAME = 60; // backend maxGoalName
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_TYPED = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

/** A month as `YYYY-MM`, null when empty, `undefined` when it is neither. A browser may show a plain text field, where `05/2027` is typed. */
export function monthOf(text: string): string | null | undefined {
  const s = text.trim();
  if (s === "") return null;
  if (MONTH.test(s)) return s;
  const typed = MONTH_TYPED.exec(s);
  return typed ? `${typed[2]}-${typed[1]!.padStart(2, "0")}` : undefined;
}

/** From the money field a zero or empty amount is `invalid`: a Goal, the reserve and the contribution all need something to reach. */
const positive = (cents: number | null): cents is number => cents !== null && cents > 0;

export function goalInputOf(f: { name: string; cents: number | null; month: string }): FormResult<{ input: GoalInput }> {
  const errors: Record<string, string> = {};
  const name = f.name.trim();
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  if (!positive(f.cents)) errors.targetCents = "invalid";
  const targetMonth = monthOf(f.month);
  if (targetMonth === undefined) errors.targetMonth = "invalid";
  if (!positive(f.cents) || targetMonth === undefined || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, targetCents: f.cents, targetMonth } };
}

export function reserveTargetOf(cents: number | null): FormResult<{ cents: number }> {
  return positive(cents) ? { ok: true, cents } : { ok: false, errors: { targetCents: "invalid" } };
}

export function contributionOf(f: { cents: number | null; share: string }): FormResult<{ baseCents: number; reserveSharePercent: number }> {
  const errors: Record<string, string> = {};
  if (!positive(f.cents)) errors.baseCents = "invalid";
  const share = /^\d{1,3}$/.test(f.share.trim()) ? Number(f.share) : -1;
  if (share < 0 || share > 100) errors.reserveSharePercent = "invalid";
  if (!positive(f.cents) || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, baseCents: f.cents, reserveSharePercent: share };
}

/** The reserve's part of the contribution, rounded half up as the API does; the Goals get the rest, so the parts add up. */
export function splitContribution(baseCents: number, sharePercent: number): { reserveCents: number; goalsCents: number } {
  const reserveCents = Math.floor((baseCents * sharePercent + 50) / 100);
  return { reserveCents, goalsCents: baseCents - reserveCents };
}

/** A copy of `ids` with `id` one place earlier or later; unchanged at the ends. */
export function moveId(ids: string[], id: string, direction: "up" | "down"): string[] {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next[from] = ids[to]!;
  next[to] = id;
  return next;
}

/** How much of the target is saved, rounded down and kept within 0..100; the text beside the bar shows the real amounts. */
export const progressPercent = (savedCents: number, targetCents: number): number =>
  targetCents <= 0 ? 0 : Math.max(0, Math.min(100, Math.floor((savedCents * 100) / targetCents)));

/**
 * What to say about when a Goal or the reserve is reached. A Goal behind its date says the same as any other
 * ("previsto para"): no countdown, no "late".
 */
export type When = { kind: "reached" } | { kind: "none" } | { kind: "beyond" } | { kind: "expected"; month: string };

export function whenOf(p: { savedCents: number; targetCents: number; monthCents: number | null; expectedMonth: string | null }): When {
  if (p.savedCents >= p.targetCents) return { kind: "reached" };
  if (p.monthCents === null) return { kind: "none" };
  if (p.expectedMonth === null) return { kind: "beyond" };
  return { kind: "expected", month: p.expectedMonth };
}

/** Every field code a Goal, the reserve or the contribution can come back with, keyed "field.code". */
const FIELD_ERROR_KEY: Record<string, MessageKey> = {
  "name.required": "goals.field.name.required",
  "name.too_long": "goals.field.name.too_long",
  "name.invalid": "goals.field.name.invalid",
  "targetCents.invalid": "goals.field.money.invalid",
  "baseCents.invalid": "goals.field.money.invalid",
  "targetMonth.invalid": "goals.field.month.invalid",
  "reserveSharePercent.invalid": "goals.field.share.invalid",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export const goalFieldErrorKey = (field: string, code: string): MessageKey => FIELD_ERROR_KEY[`${field}.${code}`] ?? "goals.field.unknown";
