import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import type { Range } from "../../shared/range";

// The shape of GET /admin/ai (backend/internal/admin/dto.go, #327). Money is integer micro-USD and always an estimate.
export interface Outcomes {
  accepted: number;
  rejected_by_referee: number;
  invalid_response: number;
  timeout: number;
  error: number;
  skipped_cap: number;
  skipped_budget: number;
}

export interface ServiceDay {
  outcomes: Outcomes;
  /** Null on a day with no calls. */
  latencyP50Ms: number | null;
  latencyMaxMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estCostMicros: number;
  /** Calls with no estimated cost (an unknown model, or no usage reported); the cost is a lower bound. */
  uncostedCalls: number;
}

export interface AiDay {
  /** YYYY-MM-DD */
  date: string;
  services: { allocator: ServiceDay; explainer: ServiceDay };
}

export interface MonthToDate {
  /** YYYY-MM */
  month: string;
  estCostMicros: number;
  uncostedCalls: number;
  /** Null when no limit is configured. */
  limitMicros: number | null;
}

export interface TemplateReasons {
  rejected_by_referee: number;
  invalid_response: number;
  timeout: number;
  error: number;
  skipped_cap: number;
  skipped_budget: number;
  partial: number;
  notAsked: number;
}

export interface AiUsage {
  range: Range;
  from: string;
  to: string;
  costIsEstimate: boolean;
  days: AiDay[];
  monthToDate: MonthToDate;
  dailyCapPerHome: number;
  allocatorShare: { llm: number; baseline: number };
  explanationShare: { llm: number; template: number; templateReasons: TemplateReasons };
  topViolationKinds: { kind: string; count: number }[];
  topFallbackReasons: { reason: string; count: number }[];
}

export async function fetchAiUsage(range: Range): Promise<AiUsage> {
  const response = await apiClient.get<AiUsage>("/admin/ai", { params: { range } });
  if (response.status !== 200) throw new Error(`GET /admin/ai answered ${response.status}`);
  return response.data;
}

export const aiKey = (range: Range) => ["admin", "ai", range] as const;

export function useAiUsage(range: Range) {
  return useQuery({ queryKey: aiKey(range), queryFn: () => fetchAiUsage(range) });
}
