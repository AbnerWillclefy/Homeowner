import { it } from "vitest";
import { Effort } from "./effort";
import { Energy } from "./energy";
import { Streak } from "./streak";

// Typecheck-only: tsc fails if an expected error ever disappears. Never called.
// Lives here, not in components/, because core never imports home (layers.test.ts).
export function requiredProps() {
  // @ts-expect-error an Effort needs its accessible name
  <Effort level={2} name="Leve" />;
  // @ts-expect-error an Energy needs its accessible name
  <Energy level={3} name="Normal" />;
  // @ts-expect-error a Streak needs its accessible name
  <Streak days={6} />;
}

it("is checked by tsc, not at runtime", () => {});
