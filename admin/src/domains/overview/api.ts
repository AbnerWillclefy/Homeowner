import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import type { Range } from "../../shared/range";

// The shape of GET /admin/overview (backend/internal/admin/dto.go, #322). Only numbers and dates: no name, email,
// user id or Chore title can be in it, and the page renders nothing that is not a field here.
export interface OverviewTotals {
  users: number;
  homes: number;
  residents: number;
  chores: number;
}

export interface OverviewActive {
  homes: number;
  residents: number;
}

export interface OverviewPushes {
  /** Accepted by the push service, not shown on a phone. */
  delivered: number;
  failed: number;
  gone: number;
  /** No outcome recorded: sent before tracking, or dropped at the deadline. */
  unknown: number;
}

export interface OverviewDay {
  /** YYYY-MM-DD */
  date: string;
  runs: number;
  rejected: number;
  fallbacks: number;
  checkins: number;
  completions: number;
  /** A lower bound: a refused Task that is later taken leaves the count. */
  refuses: number;
  takes: number;
  swapsAccepted: number;
  pushes: OverviewPushes;
}

/** The window right before the range (#372): the counters of a day, summed over the window, and no daily rows. */
export interface OverviewPrevious extends Omit<OverviewDay, "date"> {
  from: string;
  to: string;
  active: OverviewActive;
}

export interface Overview {
  range: Range;
  from: string;
  to: string;
  totals: OverviewTotals;
  active: OverviewActive;
  /** Exactly 7 or 30 entries, oldest first; a day with no data is all zeros. */
  days: OverviewDay[];
  /** Optional: an older API build leaves it out, and the page then shows no delta. */
  previous?: OverviewPrevious;
}

export async function fetchOverview(range: Range): Promise<Overview> {
  const response = await apiClient.get<Overview>("/admin/overview", { params: { range } });
  if (response.status !== 200) throw new Error(`GET /admin/overview answered ${response.status}`);
  return response.data;
}

export const overviewKey = (range: Range) => ["admin", "overview", range] as const;

export function useOverview(range: Range) {
  return useQuery({ queryKey: overviewKey(range), queryFn: () => fetchOverview(range) });
}
