import { it } from "vitest";
import { Badge } from "./badge";
import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Stepper } from "./stepper";
import { Switch } from "./switch";

// Typecheck-only: tsc fails if an expected error ever disappears. Never called.
export function requiredProps() {
  // @ts-expect-error a Button needs text
  <Button />;
  // @ts-expect-error a Badge needs text
  <Badge />;
  // @ts-expect-error a Banner needs a message
  <Banner />;
  // @ts-expect-error a Switch needs a label
  <Switch />;
  // @ts-expect-error a Checkbox needs a label
  <Checkbox />;
  // @ts-expect-error a Stepper needs its labels and value
  <Stepper />;
}

it("is checked by tsc, not at runtime", () => {});
