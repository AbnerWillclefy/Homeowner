import type { Transaction } from "../api";

/** The Expenses nothing could categorise: the API filed them under Other as a fallback. */
export const uncategorised = (rows: Transaction[]): Transaction[] =>
  rows.filter((tx) => tx.type === "expense" && tx.categorySetBy === "fallback");

/** The Expenses of one category, newest first. */
export const ofCategory = (rows: Transaction[], category: string): Transaction[] =>
  rows.filter((tx) => tx.type === "expense" && (tx.spendingCategory ?? "other") === category).sort((a, b) => b.postedOn.localeCompare(a.postedOn));
