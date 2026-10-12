import type { CatalogEntry, Proposal } from "./api";
import type { ChoreInput, ChoreWire, SaveChoreResult } from "../chores/api";
import type { FieldCodes } from "../home/api";
import type { Translate } from "../i18n";
import { formFromChore, toChoreInput, type ChoreFormState } from "../chores/form";
import { catalogName } from "./name";

/** A suggested Chore under review. Edits and removals are local until the Home is created. */
export interface ReviewItem {
  /** Stable for the life of the review, so an edit or a removal never confuses one item for another. */
  key: number;
  catalogId: string;
  instance: number | null;
  form: ChoreFormState;
}

/** The review list for the proposals, with each name built in the app's language. */
export function itemsFromProposals(proposals: readonly Proposal[], t: Translate): ReviewItem[] {
  return proposals.map((proposal, key) => ({
    key,
    catalogId: proposal.catalogId,
    instance: proposal.instance,
    form: {
      ...formFromChore({ id: "", ...proposal }),
      name: catalogName(proposal.catalogId, proposal.instance, proposal.name, t),
    },
  }));
}

/** The API's refusals that still apply after the list changed: an item that was edited or removed has answered its own. */
export function errorsStillApply(
  errors: Readonly<Record<number, FieldCodes>>,
  before: readonly ReviewItem[],
  after: readonly ReviewItem[],
): Record<number, FieldCodes> {
  const kept: Record<number, FieldCodes> = {};
  for (const item of after) {
    const old = before.find((b) => b.key === item.key);
    const itemErrors = errors[item.key];
    if (old && old.form === item.form && itemErrors) kept[item.key] = itemErrors;
  }
  return kept;
}

export interface Reviewed {
  /** The request body the list was proposed for, as text; null when the list did not come from answers. */
  proposedFor: string | null;
  /** Whether the Resident has edited or removed anything since. */
  edited: boolean;
}

/**
 * What continuing from the questionnaire does. The same answers keep the list as reviewed; changed answers
 * regenerate it, which throws away edits, so that asks first.
 */
export function afterQuestions(answersKey: string, reviewed: Reviewed | null): "propose" | "confirm" | "review" {
  if (reviewed === null || reviewed.proposedFor === null) return "propose";
  if (reviewed.proposedFor === answersKey) return "review";
  return reviewed.edited ? "confirm" : "propose";
}

/** An item as a Chore, to describe it in the list. A blank or unreadable interval reads as one-off. */
export function previewOf(item: ReviewItem): ChoreInput {
  const { intervalDays, ...rest } = toChoreInput(item.form);
  return { ...rest, intervalDays: typeof intervalDays === "number" ? intervalDays : null };
}

/** The Chores to send with the new Home, in list order. */
export function toWire(items: readonly ReviewItem[]): ChoreWire[] {
  return items.map((item) => toChoreInput(item.form));
}

export interface SplitErrors {
  /** The Home's own fields (timezone, Allocation time). */
  settings: FieldCodes;
  /** Each item's field errors, keyed by `ReviewItem.key`. */
  byItem: Record<number, FieldCodes>;
  /** More Chores than one request can carry. */
  tooMany: boolean;
}

const INDEXED = /^chores\.(\d+)\.(.+)$/;

/**
 * Sorts the API's field errors for a create. A key like `chores.2.baseEffort` is about the third Chore sent,
 * which is the item at that position in the list that was sent, so the position maps back to the item.
 */
export function splitSaveErrors(fields: FieldCodes, items: readonly ReviewItem[]): SplitErrors {
  const result: SplitErrors = { settings: {}, byItem: {}, tooMany: false };
  for (const [key, code] of Object.entries(fields)) {
    const match = INDEXED.exec(key);
    if (match) {
      const item = items[Number(match[1])];
      if (item) result.byItem[item.key] = { ...result.byItem[item.key], [match[2]!]: code };
    } else if (key === "chores") {
      result.tooMany = true;
    } else {
      result.settings[key] = code;
    }
  }
  return result;
}

/**
 * The "save" of an edit during review: nothing is sent, the edit is kept. Only a non-numeric interval is
 * refused here, because the Chore must be shaped like one; every other check is the API's, at creation.
 */
export function keepLocally(key: string, input: ChoreWire): SaveChoreResult {
  if (typeof input.intervalDays === "string") return { kind: "invalid", fields: { intervalDays: "invalid" } };
  return { kind: "ok", chore: { id: key, ...input, intervalDays: input.intervalDays } };
}

/** The Chore form for a Catalog entry added to an existing Home: pre-filled, in the app's language, editable. */
export function formFromEntry(entry: CatalogEntry, t: Translate): ChoreFormState {
  return { ...formFromChore(entry), name: catalogName(entry.id, null, entry.name, t) };
}
