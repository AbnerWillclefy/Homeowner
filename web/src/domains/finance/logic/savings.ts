import type { MessageKey } from "../../../shared/i18n";
import type { GoalInput, Investment, InvestmentInput, Serves } from "../api/api";
import { parseMoney } from "./parseMoney";

export type FormResult<T> = ({ ok: true } & T) | { ok: false; errors: Record<string, string> };

const MAX_NAME = 60; // backend maxInvestmentName and maxGoalName
const ZERO = /^(R\$)?\s*0+([.,]0{1,2})?$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_TYPED = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

const nameError = (raw: string): string | null => {
  const name = raw.trim();
  return name === "" ? "required" : [...name].length > MAX_NAME ? "too_long" : null;
};

/** Cents of an amount that may be zero (an Investment emptied but kept); `parseMoney` alone refuses zero. */
const moneyOrZero = (text: string, locale: string): number | null => (ZERO.test(text.trim()) ? 0 : parseMoney(text, locale));

export function investmentInputOf(f: { name: string; value: string; serves: Serves }, locale: string): FormResult<{ input: InvestmentInput }> {
  const errors: Record<string, string> = {};
  const name = nameError(f.name);
  if (name) errors.name = name;
  const valueCents = moneyOrZero(f.value, locale);
  if (valueCents === null) errors.valueCents = "invalid";
  if (valueCents === null || name) return { ok: false, errors };
  return { ok: true, input: { name: f.name.trim(), valueCents, serves: f.serves } };
}

/** A month as `YYYY-MM`, null when empty, `undefined` when it is neither. A browser may show a plain text field, where `05/2027` is typed. */
function monthOf(text: string): string | null | undefined {
  const s = text.trim();
  if (s === "") return null;
  if (MONTH.test(s)) return s;
  const typed = MONTH_TYPED.exec(s);
  return typed ? `${typed[2]}-${typed[1]!.padStart(2, "0")}` : undefined;
}

export function goalInputOf(f: { name: string; target: string; month: string }, locale: string): FormResult<{ input: GoalInput }> {
  const errors: Record<string, string> = {};
  const name = nameError(f.name);
  if (name) errors.name = name;
  const targetCents = parseMoney(f.target, locale);
  if (targetCents === null) errors.targetCents = "invalid";
  const targetMonth = monthOf(f.month);
  if (targetMonth === undefined) errors.targetMonth = "invalid";
  if (targetCents === null || targetMonth === undefined || name) return { ok: false, errors };
  return { ok: true, input: { name: f.name.trim(), targetCents, targetMonth } };
}

export function reserveTargetOf(text: string, locale: string): FormResult<{ cents: number }> {
  const cents = parseMoney(text, locale);
  return cents === null ? { ok: false, errors: { targetCents: "invalid" } } : { ok: true, cents };
}

export function contributionOf(f: { base: string; share: string }, locale: string): FormResult<{ baseCents: number; reserveSharePercent: number }> {
  const errors: Record<string, string> = {};
  const baseCents = parseMoney(f.base, locale);
  if (baseCents === null) errors.baseCents = "invalid";
  const share = /^\d{1,3}$/.test(f.share.trim()) ? Number(f.share) : -1;
  if (share < 0 || share > 100) errors.reserveSharePercent = "invalid";
  if (baseCents === null || share < 0 || share > 100) return { ok: false, errors };
  return { ok: true, baseCents, reserveSharePercent: share };
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

export function groupInvestments(list: Investment[]): { serves: Serves; items: Investment[]; subtotalCents: number }[] {
  return (["reserve", "goals"] as const)
    .map((serves) => {
      const items = list.filter((i) => i.serves === serves);
      return { serves, items, subtotalCents: items.reduce((sum, i) => sum + i.valueCents, 0) };
    })
    .filter((g) => g.items.length > 0);
}

const FIELD_KEY: Record<string, MessageKey> = {
  "name.required": "finances.savings.field.name.required",
  "name.too_long": "finances.savings.field.name.too_long",
  "name.invalid": "finances.savings.field.name.invalid",
  "valueCents.invalid": "finances.savings.field.money.invalid",
  "targetCents.invalid": "finances.savings.field.money.invalid",
  "baseCents.invalid": "finances.savings.field.money.invalid",
  "targetMonth.invalid": "finances.savings.field.month.invalid",
  "reserveSharePercent.invalid": "finances.savings.field.share.invalid",
};

/** The message for a field's code, from the form or the API; a code this app does not know still gets one. */
export const savingsFieldErrorKey = (field: string, code: string): MessageKey => FIELD_KEY[`${field}.${code}`] ?? "finances.savings.field.unknown";
