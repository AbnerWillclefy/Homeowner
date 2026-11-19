import { describe, expect, it } from "vitest";
import type { ReceiptDraft } from "../api";
import { blankLine, formOf, parseMilli, quantityField, sumCents, validate, type DraftForm } from "./photoDraft";

const DRAFT: ReceiptDraft = {
  storeName: "Bom Preço",
  storeCnpj: "",
  accessKey: "",
  issuedOn: "2030-01-02",
  totalCents: 5700,
  lines: [
    { description: "Arroz 5 kg", quantityMilli: 1000, unit: "UN", unitPriceCents: 2790, totalCents: 2790 },
    { description: "Queijo", quantityMilli: 450, unit: "KG", unitPriceCents: 6467, totalCents: 2910 },
  ],
};
const TODAY = "2030-01-02";
const form = (over: Partial<DraftForm> = {}): DraftForm => ({ ...formOf(DRAFT), ...over });
const errors = (f: DraftForm) => {
  const out = validate(f, TODAY);
  return out.ok ? null : Object.keys(out.errors).sort();
};

describe("quantities", () => {
  it.each([["1", 1000], ["0,450", 450], ["0.45", 450], ["1,5", 1500], [" 2 ", 2000], ["12,345", 12345]])("reads %s as %d thousandths", (text, milli) => {
    expect(parseMilli(text)).toBe(milli);
  });
  it.each([[""], ["abc"], ["1,2345"], ["-1"], ["1,2,3"], ["0"]])("refuses %j", (text) => {
    expect(parseMilli(text)).toBeNull();
  });
  it("shows thousandths in the locale's decimal mark, without grouping", () => {
    expect(quantityField(450, "pt-BR")).toBe("0,45");
    expect(quantityField(1500, "en")).toBe("1.5");
    expect(quantityField(1_234_000, "pt-BR")).toBe("1234");
  });
});

describe("validate", () => {
  it("returns the draft as the API takes it, with the corrected values", () => {
    const f = form();
    f.lines[0] = { ...f.lines[0]!, description: "  Arroz 10 kg ", quantity: "2", unitPriceCents: 1395, totalCents: 2790 };
    expect(validate(f, TODAY)).toEqual({ ok: true, draft: { ...DRAFT, lines: [{ description: "Arroz 10 kg", quantityMilli: 2000, unit: "UN", unitPriceCents: 1395, totalCents: 2790 }, DRAFT.lines[1]] } });
  });

  it("marks the same field codes the API answers", () => {
    expect(errors(form({ storeName: " " }))).toEqual(["storeName"]);
    expect(errors(form({ storeName: "x".repeat(121) }))).toEqual(["storeName"]);
    expect(errors(form({ issuedOn: "2030-01-03" }))).toEqual(["issuedOn"]);
    expect(errors(form({ issuedOn: "02/01/2030" }))).toEqual(["issuedOn"]);
    expect(errors(form({ issuedOn: "2030-02-31" }))).toEqual(["issuedOn"]);
    expect(errors(form({ totalCents: null }))).toEqual(["totalCents"]);
    expect(errors(form({ lines: [], totalCents: 0 }))).toEqual(["lines"]);
    expect(errors(form({ lines: Array.from({ length: 201 }, (_, i) => ({ ...blankLine(i), description: "a", quantity: "1", unitPriceCents: 0, totalCents: 0 })), totalCents: 0 }))).toEqual(["lines"]);
  });

  it("marks each field of a line by its position", () => {
    const f = form();
    f.lines[1] = { ...f.lines[1]!, description: "", quantity: "0", unit: "x".repeat(11), unitPriceCents: null, totalCents: null };
    expect(errors(f)).toEqual(["lines.2.description", "lines.2.quantityMilli", "lines.2.totalCents", "lines.2.unit", "lines.2.unitPriceCents", "totalCents"].sort());
  });

  it("allows the lines to differ from the total by R$0,05 and no more", () => {
    expect(errors(form({ totalCents: 5705 }))).toBeNull();
    expect(errors(form({ totalCents: 5695 }))).toBeNull();
    expect(errors(form({ totalCents: 5706 }))).toEqual(["totalCents"]);
    expect(errors(form({ totalCents: 5694 }))).toEqual(["totalCents"]);
  });

  it("sums the lines, ignoring one with no total yet", () => {
    const f = form();
    expect(sumCents(f)).toBe(5700);
    f.lines[0] = { ...f.lines[0]!, totalCents: null };
    expect(sumCents(f)).toBe(2910);
  });
});

describe("formOf", () => {
  it("gives every line its own key, and a blank line is empty for the User to fill", () => {
    const f = formOf(DRAFT, "pt-BR");
    expect(new Set(f.lines.map((l) => l.key)).size).toBe(2);
    expect(f.lines[1]!.quantity).toBe("0,45");
    expect(blankLine(9)).toMatchObject({ key: 9, description: "", quantity: "1", unit: "UN", unitPriceCents: null, totalCents: null });
  });
});
