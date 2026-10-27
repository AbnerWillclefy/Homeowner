import { describe, expect, it } from "vitest";
import type { FlowStep } from "./api";
import { buildFunnel, isEmptyFlow } from "./funnel";

const step = (id: string, count: number, of?: string): FlowStep => (of === undefined ? { id, count } : { id, count, of });

/** A funnel as #328 sends it, with any count overridable. */
function steps(over: Record<string, number> = {}): FlowStep[] {
  const n = (id: string, fallback: number) => over[id] ?? fallback;
  return [
    step("homesDue", n("homesDue", 100)),
    step("runs", n("runs", 80), "homesDue"),
    step("llmAsked", n("llmAsked", 60), "runs"),
    step("llmSkipped", n("llmSkipped", 0), "runs"),
    step("llmAccepted", n("llmAccepted", 60), "llmAsked"),
    step("llmFallback", n("llmFallback", 0), "llmAsked"),
    step("rejectedRuns", n("rejectedRuns", 0), "runs"),
    step("explanationsLlm", n("explanationsLlm", 30)),
    step("explanationsTemplate", n("explanationsTemplate", 10)),
    step("pushesDelivered", n("pushesDelivered", 10)),
    step("pushesFailed", n("pushesFailed", 0)),
    step("pushesGone", n("pushesGone", 0)),
    step("pushesUnknown", n("pushesUnknown", 0)),
  ];
}

const ZEROS = { homesDue: 0, runs: 0, llmAsked: 0, llmAccepted: 0, explanationsLlm: 0, explanationsTemplate: 0, pushesDelivered: 0 };

type Rows = ReturnType<typeof buildFunnel>;
const row = (rows: Rows, id: string) => rows.find((r) => r.id === id)!;
const weakest = (rows: Rows) => rows.filter((r) => r.weakest).map((r) => r.id);

describe("buildFunnel", () => {
  it("keeps the server's order and divides each count by its reference", () => {
    const rows = buildFunnel(steps());
    expect(rows.map((r) => r.id)).toEqual(steps().map((s) => s.id));
    expect(row(rows, "runs").rate).toBe(0.8);
    expect(row(rows, "runs").rateText).toBe("80% of Homes due (20% not planned)");
    expect(row(rows, "llmAccepted").rateText).toBe("100% of LLM asked");
    expect(row(rows, "homesDue").rateText).toBe("");
  });

  it("measures pushes against all the pushes and explanations against all the explanations", () => {
    const rows = buildFunnel(steps({ pushesDelivered: 4, pushesFailed: 6 }));
    expect(row(rows, "pushesFailed").rateText).toBe("6 failed (60%)");
    expect(row(rows, "pushesDelivered").rateText).toBe("40% of pushes");
    expect(row(rows, "explanationsLlm").rateText).toBe("75% of explanations");
  });

  it("flags the step with the highest failure or drop rate", () => {
    const rows = buildFunnel(steps({ pushesDelivered: 4, pushesFailed: 6, llmFallback: 3 }));
    expect(weakest(rows)).toEqual(["pushesFailed"]);
  });

  it("flags both when two steps tie", () => {
    const rows = buildFunnel(steps({ runs: 100, rejectedRuns: 10, pushesDelivered: 90, pushesFailed: 10 }));
    expect(weakest(rows)).toEqual(["rejectedRuns", "pushesFailed"]);
  });

  it("flags nothing when no step fails or drops", () => {
    expect(weakest(buildFunnel(steps({ runs: 100 })))).toEqual([]);
  });

  it("gives a null rate, shown n/a, when the reference is 0, and never NaN or Infinity", () => {
    const rows = buildFunnel(steps(ZEROS));
    for (const r of rows) {
      expect(r.rateText).not.toMatch(/NaN|Infinity/);
      expect(Number.isNaN(r.rate)).toBe(false);
    }
    expect(row(rows, "runs").rate).toBeNull();
    expect(row(rows, "runs").rateText).toBe("n/a");
    expect(row(rows, "pushesFailed").rateText).toBe("n/a");
    expect(weakest(rows)).toEqual([]);
  });

  it("shows a count above its reference as it is, with no negative drop", () => {
    const rows = buildFunnel(steps({ homesDue: 10, runs: 12 }));
    expect(row(rows, "runs").rate).toBe(1.2);
    expect(row(rows, "runs").dropRate).toBeNull();
    expect(row(rows, "runs").rateText).toBe("120% of Homes due");
    expect(weakest(rows)).not.toContain("runs");
  });

  it("flags a drop along the pipeline, such as Homes not planned", () => {
    expect(weakest(buildFunnel(steps({ homesDue: 100, runs: 50 })))).toEqual(["runs"]);
  });

  it("keeps an unknown step, labelled by its id and measured against nothing", () => {
    const rows = buildFunnel([step("brandNew", 4)]);
    expect(rows[0]).toMatchObject({ id: "brandNew", label: "brandNew", count: 4, rate: null, weakest: false });
  });
});

describe("isEmptyFlow", () => {
  it("is true only when every count is 0", () => {
    expect(isEmptyFlow(steps(ZEROS))).toBe(true);
    expect(isEmptyFlow(steps())).toBe(false);
    expect(isEmptyFlow([])).toBe(true);
  });
});
