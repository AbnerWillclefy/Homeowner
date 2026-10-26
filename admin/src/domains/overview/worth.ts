import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import type { Range } from "../../shared/range";

// The shape of GET /admin/worth (backend/internal/admin/dto.go, #373): counts only, so no name, email, user id or
// Chore title can be in it. The page divides, guarding zero (headline.ts), and renders nothing that is not a field here.

/** Outcome of the planned runs of one arm. `refused` is a lower bound. */
export interface ArmOutcome {
  proposed: number;
  completed: number;
  refused: number;
}

export interface WorthReliability {
  runsLlm: number;
  runsFallback: number;
  /** Runs where the LLM was not asked: switched off, or nothing worth asking. */
  runsLlmNotAsked: number;
  allocatorCalls: number;
  refereeRejected: number;
}

export interface WorthCounts {
  outcome: { llm: ArmOutcome; baseline: ArmOutcome };
  reliability: WorthReliability;
  cost: { allocatorCostMicros: number; uncostedCalls: number };
  explanations: { llm: number; template: number };
}

export interface WorthDay extends WorthCounts {
  /** YYYY-MM-DD */
  date: string;
}

export interface WorthPrevious extends WorthCounts {
  from: string;
  to: string;
}

export interface WorthMonthToDate {
  month: string;
  estCostMicros: number;
  uncostedCalls: number;
  limitMicros: number | null;
}

export interface Worth {
  range: Range;
  from: string;
  to: string;
  costIsEstimate: boolean;
  current: WorthCounts;
  /** Optional: an older API build leaves it out, and the page then shows no delta. */
  previous?: WorthPrevious;
  /** Exactly 7 or 30 entries, oldest first; a day with no data is all zeros. */
  days: WorthDay[];
  monthToDate: WorthMonthToDate;
}

export async function fetchWorth(range: Range): Promise<Worth> {
  const response = await apiClient.get<Worth>("/admin/worth", { params: { range } });
  if (response.status !== 200) throw new Error(`GET /admin/worth answered ${response.status}`);
  return response.data;
}

export const worthKey = (range: Range) => ["admin", "worth", range] as const;

export function useWorth(range: Range) {
  return useQuery({ queryKey: worthKey(range), queryFn: () => fetchWorth(range) });
}
