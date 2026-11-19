import { describe, expect, it } from "vitest";
import type { AddReceiptResult, Receipt, ReceiptDraft, ReceiptLine } from "../api";
import { currentLine, quantityText, reduce, START, type Step } from "./addReceipt";

const line = (n: number, over: Partial<ReceiptLine> = {}): ReceiptLine => ({ n, description: `L${n}`, quantityMilli: 1000, unit: "UN", unitPriceCents: 100, totalCents: 100, itemId: null, ignored: false, ...over });
const receipt = (lines: ReceiptLine[]): Receipt => ({ id: "r1", storeName: "Bom Preço", issuedOn: "2030-01-02", totalCents: 300, readBy: "sefaz", lines });
const answer = (kind: "created" | "duplicate", r: Receipt): AddReceiptResult => ({ kind, receipt: r });
const saving: Step = { kind: "saving" };

describe("moving between the first steps", () => {
  it("goes from choose to scan or paste, and back", () => {
    expect(reduce(START, { type: "scan" })).toEqual({ kind: "scan" });
    expect(reduce(START, { type: "paste" })).toEqual({ kind: "paste", notice: null });
    expect(reduce({ kind: "scan" }, { type: "choose" })).toEqual(START);
  });

  it("falls back to paste with a notice when the camera is denied while scanning, and only then", () => {
    expect(reduce({ kind: "scan" }, { type: "denied" })).toEqual({ kind: "paste", notice: "denied" });
    expect(reduce(START, { type: "denied" })).toEqual(START);
  });

  it("shows saving on submit", () => {
    expect(reduce({ kind: "paste", notice: null }, { type: "submit" })).toEqual(saving);
  });
});

describe("the answer to a receipt", () => {
  it("lists only the unmatched lines of a new receipt, skipping matched and ignored ones", () => {
    const r = receipt([line(1, { itemId: "p1" }), line(2), line(3, { ignored: true }), line(4)]);
    expect(reduce(saving, { type: "answer", result: answer("created", r) })).toEqual({ kind: "matching", receipt: r, queue: [2, 4], total: 2 });
  });

  it("resumes a duplicate that still has unmatched lines", () => {
    const r = receipt([line(1, { itemId: "p1" }), line(2)]);
    expect(reduce(saving, { type: "answer", result: answer("duplicate", r) })).toEqual({ kind: "matching", receipt: r, queue: [2], total: 1 });
  });

  it("shows a duplicate with nothing left as already added", () => {
    const r = receipt([line(1, { itemId: "p1" }), line(2, { ignored: true })]);
    expect(reduce(saving, { type: "answer", result: answer("duplicate", r) })).toEqual({ kind: "done", updated: 1, already: true });
  });

  it("goes straight to done when every line of a new receipt is matched", () => {
    const r = receipt([line(1, { itemId: "p1" }), line(2, { itemId: "p2" })]);
    expect(reduce(saving, { type: "answer", result: answer("created", r) })).toEqual({ kind: "done", updated: 2, already: false });
  });

  it.each([
    [{ kind: "invalid" }, { kind: "paste", notice: "invalid" }],
    [{ kind: "error" }, { kind: "paste", notice: "failed" }],
    [{ kind: "unavailable" }, { kind: "unavailable" }],
  ] as const)("answers %j with %j", (result, next) => {
    expect(reduce(saving, { type: "answer", result })).toEqual(next);
  });

  it("ignores an answer that arrives outside saving", () => {
    expect(reduce(START, { type: "answer", result: { kind: "error" } })).toEqual(START);
  });
});

describe("matching", () => {
  const first = receipt([line(1), line(2), line(3, { itemId: "p9" })]);
  const matching = reduce(saving, { type: "answer", result: answer("created", first) });

  it("moves to the next line and keeps the total, then finishes counting the lines matched to items", () => {
    const afterOne = receipt([line(1, { itemId: "p1" }), line(2), line(3, { itemId: "p9" })]);
    const next = reduce(matching, { type: "matched", receipt: afterOne });
    expect(next).toMatchObject({ kind: "matching", queue: [2], total: 2 });
    expect(currentLine(next as Extract<Step, { kind: "matching" }>)?.n).toBe(2);
    const afterTwo = receipt([line(1, { itemId: "p1" }), line(2, { ignored: true }), line(3, { itemId: "p9" })]);
    expect(reduce(next, { type: "matched", receipt: afterTwo })).toEqual({ kind: "done", updated: 2, already: false });
  });
});

describe("quantityText", () => {
  it("writes weights with the locale's decimal mark and units in lower case", () => {
    expect(quantityText(line(1, { quantityMilli: 1500, unit: "KG" }), "pt-BR")).toBe("1,5 kg");
    expect(quantityText(line(1, { quantityMilli: 1500, unit: "KG" }), "en")).toBe("1.5 kg");
    expect(quantityText(line(1), "pt-BR")).toBe("1 un");
  });
});

describe("the photo steps", () => {
  const draft: ReceiptDraft = { storeName: "Bom Preço", storeCnpj: "", accessKey: "", issuedOn: "2030-01-02", totalCents: 100, lines: [] };
  const onDraft = (over = {}): Step => ({ kind: "draft", draft, saving: false, fields: [], failed: false, ...over });

  it("reads once a photo is chosen, then shows the draft, or why there is none", () => {
    const reading = reduce(START, { type: "photo" });
    expect(reading).toEqual({ kind: "reading" });
    expect(reduce(reading, { type: "read", result: { kind: "draft", draft } })).toEqual(onDraft());
    for (const kind of ["cap", "unreadable", "error"] as const) expect(reduce(reading, { type: "read", result: { kind } })).toEqual({ kind: "photoFailed", reason: kind });
    expect(reduce(START, { type: "read", result: { kind: "cap" } })).toEqual(START);
  });

  it("keeps the draft while it saves, and marks the fields a refusal names or a failure", () => {
    const saving = reduce(onDraft({ fields: ["totalCents"], failed: true }), { type: "saveDraft" });
    expect(saving).toEqual(onDraft({ saving: true }));
    expect(reduce(saving, { type: "drafted", result: { kind: "rejected", fields: ["totalCents"] } })).toEqual(onDraft({ fields: ["totalCents"] }));
    expect(reduce(saving, { type: "drafted", result: { kind: "error" } })).toEqual(onDraft({ failed: true }));
  });

  it("continues to matching, or to done for a duplicate with nothing left, after the save", () => {
    const r = receipt([line(1, { itemId: "p1" }), line(2)]);
    expect(reduce(onDraft({ saving: true }), { type: "drafted", result: { kind: "created", receipt: r } })).toEqual({ kind: "matching", receipt: r, queue: [2], total: 1 });
    const done = receipt([line(1, { itemId: "p1" })]);
    expect(reduce(onDraft({ saving: true }), { type: "drafted", result: { kind: "duplicate", receipt: done } })).toEqual({ kind: "done", updated: 1, already: true });
    expect(reduce(START, { type: "drafted", result: { kind: "created", receipt: r } })).toEqual(START);
  });
});
