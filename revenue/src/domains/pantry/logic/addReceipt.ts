import type { AddReceiptResult, ReadPhotoResult, Receipt, ReceiptDraft, ReceiptLine, SaveDraftResult } from "../api";

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
  | { kind: "unavailable" }
  /** A photo was chosen: it is downsized and read, which can take 20 s. */
  | { kind: "reading" }
  /** The photo was refused: the daily cap, a photo the model could not read, or any other failure. */
  | { kind: "photoFailed"; reason: "cap" | "unreadable" | "error" }
  /** The draft to check. Nothing is saved until the User confirms; `fields` are the ones the API refused, `failed` a save that did not go through. */
  | { kind: "draft"; draft: ReceiptDraft; saving: boolean; fields: string[]; failed: boolean };

export type Event =
  | { type: "choose" | "scan" | "paste" | "denied" | "submit" }
  | { type: "answer"; result: AddReceiptResult }
  | { type: "matched"; receipt: Receipt }
  | { type: "photo" }
  | { type: "read"; result: ReadPhotoResult }
  | { type: "saveDraft" }
  | { type: "drafted"; result: SaveDraftResult };

export const START: Step = { kind: "choose" };

const unmatched = (lines: ReceiptLine[]) => lines.filter((l) => l.itemId === null && !l.ignored).map((l) => l.n);
const updatedCount = (receipt: Receipt) => receipt.lines.filter((l) => l.itemId !== null).length;

/** After a receipt is stored: match its unmatched lines, or finish when there are none. */
function afterSave(receipt: Receipt, duplicate: boolean): Step {
  const queue = unmatched(receipt.lines);
  return queue.length > 0 ? { kind: "matching", receipt, queue, total: queue.length } : { kind: "done", updated: updatedCount(receipt), already: duplicate };
}

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
      return afterSave(result.receipt, result.kind === "duplicate");
    }
    case "photo":
      return { kind: "reading" };
    case "read": {
      if (step.kind !== "reading") return step;
      const { result } = event;
      return result.kind === "draft" ? { kind: "draft", draft: result.draft, saving: false, fields: [], failed: false } : { kind: "photoFailed", reason: result.kind };
    }
    case "saveDraft":
      return step.kind === "draft" ? { ...step, saving: true, fields: [], failed: false } : step;
    case "drafted": {
      if (step.kind !== "draft") return step;
      const { result } = event;
      if (result.kind === "rejected") return { ...step, saving: false, fields: result.fields };
      if (result.kind === "error") return { ...step, saving: false, failed: true };
      return afterSave(result.receipt, result.kind === "duplicate");
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
