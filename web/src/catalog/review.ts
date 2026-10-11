import type { CatalogEntry, Proposal } from "../api/catalog";
import type { ChoreWire, SaveChoreResult } from "../api/chores";
import type { FieldCodes } from "../api/home";
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
