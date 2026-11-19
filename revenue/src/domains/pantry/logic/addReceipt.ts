import type { AddReceiptResult, Receipt, ReceiptLine } from "../api";

/** Why the paste step shows a message above the field: the camera is unusable, the code was refused, or the read failed. */
export type PasteNotice = "denied" | "invalid" | "failed" | null;

export type Step =
  | { kind: "choose" }
  | { kind: "scan" }
  | { kind: "paste"; notice: PasteNotice }
  | { kind: "saving" }
  /** `queue` holds the line numbers still to match, the one on screen first; `total` is how many there were on entry. */
  | { kind: "matching"; receipt: Receipt; queue: number[]; total: number }
  /** `already`: the receipt was added before and had nothing left to match. `updated` counts lines matched to items. */
  | { kind: "done"; updated: number; already: boolean }
  | { kind: "unavailable" };

export type Event =
  | { type: "choose" | "scan" | "paste" | "denied" | "submit" }
  | { type: "answer"; result: AddReceiptResult }
  | { type: "matched"; receipt: Receipt };

export const START: Step = { kind: "choose" };

const unmatched = (lines: ReceiptLine[]) => lines.filter((l) => l.itemId === null && !l.ignored).map((l) => l.n);
const updatedCount = (receipt: Receipt) => receipt.lines.filter((l) => l.itemId !== null).length;

/** The next step. An event that does not fit the current step leaves it alone. */
export function reduce(step: Step, event: Event): Step {
  switch (event.type) {
    case "choose":
      return START;
    case "scan":
      return { kind: "scan" };
    case "paste":
      return { kind: "paste", notice: null };
    case "denied":
      return step.kind === "scan" ? { kind: "paste", notice: "denied" } : step;
    case "submit":
      return { kind: "saving" };
    case "answer": {
      if (step.kind !== "saving") return step;
      const { result } = event;
      if (result.kind === "invalid") return { kind: "paste", notice: "invalid" };
      if (result.kind === "unavailable") return { kind: "unavailable" };
      if (result.kind === "error") return { kind: "paste", notice: "failed" };
      const queue = unmatched(result.receipt.lines);
      if (queue.length > 0) return { kind: "matching", receipt: result.receipt, queue, total: queue.length };
      return { kind: "done", updated: updatedCount(result.receipt), already: result.kind === "duplicate" };
    }
    case "matched": {
      if (step.kind !== "matching") return step;
      const queue = step.queue.slice(1);
      return queue.length > 0 ? { ...step, receipt: event.receipt, queue } : { kind: "done", updated: updatedCount(event.receipt), already: false };
    }
  }
}

/** The line on screen in a matching step. */
export const currentLine = (step: Extract<Step, { kind: "matching" }>): ReceiptLine | undefined => step.receipt.lines.find((l) => l.n === step.queue[0]);

/** "1,5 kg", "1 un": thousandths of the unit, in the locale's number format. */
export function quantityText(line: ReceiptLine, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(line.quantityMilli / 1000)} ${line.unit.toLowerCase()}`;
}
