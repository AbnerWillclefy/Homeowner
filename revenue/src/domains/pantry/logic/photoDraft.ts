import type { ReceiptDraft, ReceiptDraftLine } from "../api";

/** One line while it is edited: the quantity is the text typed, and an amount not filled yet is null. `key` keeps React's rows apart. */
export interface DraftLineForm {
  key: number;
  description: string;
  quantity: string;
  unit: string;
  unitPriceCents: number | null;
  totalCents: number | null;
}

/** A draft while it is edited; `storeCnpj` and `accessKey` ride along unchanged. */
export interface DraftForm {
  storeName: string;
  storeCnpj: string;
  accessKey: string;
  issuedOn: string;
  totalCents: number | null;
  lines: DraftLineForm[];
}

/** The API's limits for a draft (`backend/internal/pantry/rules.go`), checked here first. */
const MAX_TEXT = 120;
const MAX_UNIT = 10;
const MAX_LINES = 200;
const MAX_CENTS = 10_000_000_000;
const MAX_MILLI = 1_000_000_000;
/** The lines may differ from the total by this much (the rounding of a receipt). */
export const SUM_TOLERANCE_CENTS = 5;

/** Thousandths from "1", "0,450" or "1.5"; null when empty, not a number, over three decimals, or not above zero. */
export function parseMilli(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text.trim());
  if (!match) return null;
  const milli = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return milli > 0 ? milli : null;
}

/** Thousandths as typed in the locale, without a thousands separator: 450 is "0,45" in pt-BR. */
export const quantityField = (milli: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(milli / 1000);

const lineFormOf = (l: ReceiptDraftLine, key: number, locale: string): DraftLineForm => ({
  key,
  description: l.description,
  quantity: quantityField(l.quantityMilli, locale),
  unit: l.unit,
  unitPriceCents: l.unitPriceCents,
  totalCents: l.totalCents,
});

export const formOf = (draft: ReceiptDraft, locale = "pt-BR"): DraftForm => ({
  storeName: draft.storeName,
  storeCnpj: draft.storeCnpj,
  accessKey: draft.accessKey,
  issuedOn: draft.issuedOn,
  totalCents: draft.totalCents,
  lines: draft.lines.map((l, i) => lineFormOf(l, i, locale)),
});

/** A line the User adds: one unit, the rest empty. */
export const blankLine = (key: number): DraftLineForm => ({ key, description: "", quantity: "1", unit: "UN", unitPriceCents: null, totalCents: null });

/** The lines' totals added up; a line with no total yet counts nothing. */
export const sumCents = (form: DraftForm) => form.lines.reduce((sum, l) => sum + (l.totalCents ?? 0), 0);

const validDay = (day: string, today: string) => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : null;
  return parsed !== null && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day) && day <= today;
};
const cents = (v: number | null): v is number => v !== null && v >= 0 && v <= MAX_CENTS;

/**
 * Checks a draft against the API's limits. On success, the draft to send; otherwise the fields that fail, named as the
 * API names them (`storeName`, `lines.2.description`), each with the code `invalid`. `today` is São Paulo's day.
 */
export function validate(form: DraftForm, today: string): { ok: true; draft: ReceiptDraft } | { ok: false; errors: Record<string, "invalid"> } {
  const errors: Record<string, "invalid"> = {};
  const check = (field: string, ok: boolean) => {
    if (!ok) errors[field] = "invalid";
  };
  const storeName = form.storeName.trim();
  check("storeName", storeName.length >= 1 && [...storeName].length <= MAX_TEXT);
  check("issuedOn", validDay(form.issuedOn, today));
  check("lines", form.lines.length >= 1 && form.lines.length <= MAX_LINES);
  const lines: ReceiptDraftLine[] = [];
  form.lines.forEach((l, i) => {
    const at = (field: string) => `lines.${i + 1}.${field}`;
    const description = l.description.trim();
    const quantityMilli = parseMilli(l.quantity);
    const unit = l.unit.trim();
    check(at("description"), description.length >= 1 && [...description].length <= MAX_TEXT);
    check(at("quantityMilli"), quantityMilli !== null && quantityMilli <= MAX_MILLI);
    check(at("unit"), [...unit].length <= MAX_UNIT);
    check(at("unitPriceCents"), cents(l.unitPriceCents));
    check(at("totalCents"), cents(l.totalCents));
    lines.push({ description, quantityMilli: quantityMilli ?? 0, unit, unitPriceCents: l.unitPriceCents ?? 0, totalCents: l.totalCents ?? 0 });
  });
  check("totalCents", cents(form.totalCents) && Math.abs(sumCents(form) - form.totalCents) <= SUM_TOLERANCE_CENTS);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, draft: { storeName, storeCnpj: form.storeCnpj, accessKey: form.accessKey, issuedOn: form.issuedOn, totalCents: form.totalCents ?? 0, lines } };
}
