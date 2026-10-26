import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import type { Range } from "../../shared/range";

// The shape of GET /admin/flow (backend/internal/admin/dto.go, #328): counts only, in pipeline order.
export interface FlowStep {
  id: string;
  count: number;
  /** The id of the step this one is measured against; absent when it has none. */
  of?: string;
}

export interface Flow {
  range: Range;
  from: string;
  to: string;
  steps: FlowStep[];
}

export async function fetchFlow(range: Range): Promise<Flow> {
  const response = await apiClient.get<Flow>("/admin/flow", { params: { range } });
  if (response.status !== 200) throw new Error(`GET /admin/flow answered ${response.status}`);
  return response.data;
}

export const flowKey = (range: Range) => ["admin", "flow", range] as const;

export function useFlow(range: Range) {
  return useQuery({ queryKey: flowKey(range), queryFn: () => fetchFlow(range) });
}
