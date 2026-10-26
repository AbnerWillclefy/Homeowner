import type { FlowStep } from "./api";

// How each step reads. `progress` rows say how much of the reference got through; `failure` rows count what went
// wrong, so their rate is a failure rate; `drop` rows lose the reference's remainder along the way.
type Tone = "progress" | "failure" | "drop";

interface StepInfo {
  label: string;
  description?: string;
  tone: Tone;
  /** For `failure` rows: the verb in "3 failed (12%)". */
  verb?: string;
  /** For `drop` rows: what the remainder is called, in "20% not planned". */
  lost?: string;
  /** A group whose members are measured against the group's total, for steps the server sends with no `of`. */
  group?: "pushes" | "explanations";
}

const STEPS: Record<string, StepInfo> = {
  homesDue: { label: "Homes due", description: "Homes that existed that day", tone: "progress" },
  runs: { label: "Runs", description: "Homes whose Day Plan was planned", tone: "drop", lost: "not planned" },
  llmAsked: { label: "LLM asked", description: "allocator calls that were made", tone: "progress" },
  llmSkipped: { label: "LLM skipped", description: "stopped by the call cap or the budget", tone: "failure", verb: "skipped" },
  llmAccepted: { label: "LLM plan accepted", description: "the referee took the LLM's plan", tone: "progress" },
  llmFallback: { label: "Fell back to baseline", description: "asked, but the plan was not used", tone: "failure", verb: "fell back" },
  rejectedRuns: { label: "Rejected runs", description: "baseline refused by the referee", tone: "failure", verb: "rejected" },
  explanationsLlm: { label: "Explanations by LLM", description: "counts Residents, not Homes", tone: "progress", group: "explanations" },
  explanationsTemplate: { label: "Explanations by template", description: "counts Residents, not Homes", tone: "progress", group: "explanations" },
  pushesDelivered: { label: "Pushes delivered", description: "Day Plan ready, accepted by push service", tone: "progress", group: "pushes" },
  pushesFailed: { label: "Pushes failed", description: "the push service refused it", tone: "failure", verb: "failed", group: "pushes" },
  pushesGone: { label: "Pushes gone", description: "the phone's subscription had expired", tone: "failure", verb: "gone", group: "pushes" },
  pushesUnknown: { label: "Pushes unknown", description: "no outcome recorded", tone: "progress", group: "pushes" },
};

const GROUP_LABELS = { pushes: "pushes", explanations: "explanations" } as const;

export interface FunnelRow {
  id: string;
  label: string;
  description: string | null;
  count: number;
  /** What the rate is measured against, for the text; null when nothing. */
  referenceLabel: string | null;
  /** count / reference; null when there is no reference or it is 0. May exceed 1. */
  rate: number | null;
  /** The share lost or failed, 0 to 1; null when this step has none or cannot be measured. */
  dropRate: number | null;
  /** Ready to show: "82% of Homes due", "3 failed (12%)", "n/a" or "" when the step has no reference. */
  rateText: string;
  /** True for the step (or steps, on a tie) with the highest positive drop or failure rate. */
  weakest: boolean;
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Turns #328's ordered steps into display rows. A reference of 0 gives a null rate ("n/a"), never NaN. */
export function buildFunnel(steps: FlowStep[]): FunnelRow[] {
  const counts = new Map(steps.map((s) => [s.id, s.count]));
  const groupTotal = (group: string) =>
    steps.reduce((sum, s) => sum + (STEPS[s.id]?.group === group ? s.count : 0), 0);

  const rows = steps.map((s): FunnelRow => {
    const info = STEPS[s.id];
    let reference: number | null = null;
    let referenceLabel: string | null = null;
    if (info?.group) {
      reference = groupTotal(info.group);
      referenceLabel = GROUP_LABELS[info.group];
    } else if (s.of !== undefined && s.of !== "" && counts.has(s.of)) {
      reference = counts.get(s.of)!;
      referenceLabel = STEPS[s.of]?.label ?? s.of;
    }

    const base = {
      id: s.id,
      label: info?.label ?? s.id,
      description: info?.description ?? null,
      count: s.count,
      referenceLabel,
      weakest: false,
    };
    if (referenceLabel === null) return { ...base, rate: null, dropRate: null, rateText: "" };
    if (reference === null || reference <= 0) return { ...base, rate: null, dropRate: null, rateText: "n/a" };

    const rate = s.count / reference;
    // Counts above their reference are real (a different unit, say): show them, and compute no drop.
    const dropRate =
      info?.tone === "failure" ? rate : info?.tone === "drop" && s.count <= reference ? (reference - s.count) / reference : null;

    let rateText = `${percent(rate)} of ${referenceLabel}`;
    if (info?.tone === "failure") rateText = `${s.count} ${info.verb ?? "failed"} (${percent(rate)})`;
    else if (info?.tone === "drop" && dropRate !== null && dropRate > 0) rateText += ` (${percent(dropRate)} ${info.lost})`;
    return { ...base, rate, dropRate, rateText };
  });

  const worst = Math.max(0, ...rows.map((r) => r.dropRate ?? 0));
  return worst > 0 ? rows.map((r) => ({ ...r, weakest: r.dropRate === worst })) : rows;
}

/** True when there is nothing to show: every step is 0, or the server sent none. */
export function isEmptyFlow(steps: FlowStep[]): boolean {
  return steps.every((s) => s.count === 0);
}
