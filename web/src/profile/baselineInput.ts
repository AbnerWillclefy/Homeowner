/** Largest Baseline in points. Keep in step with MaxBaseline in backend/internal/profile. */
export const MAX_BASELINE = 20;

export type BaselineInput =
  /** Empty field: the day becomes unset. */
  | { kind: "clear" }
  /** 0 is a real value ("nothing that day"), not a clear. */
  | { kind: "set"; points: number }
  /** Not sent: negative, fractional, over the maximum or not a number. */
  | { kind: "invalid" };

/** Turns what the person typed into what to send, so the screen never posts a value the API would refuse. */
export function parseBaselineInput(raw: string): BaselineInput {
  const text = raw.trim();
  if (text === "") return { kind: "clear" };
  if (!/^\d+$/.test(text)) return { kind: "invalid" };
  const points = Number(text);
  return points <= MAX_BASELINE ? { kind: "set", points } : { kind: "invalid" };
}
