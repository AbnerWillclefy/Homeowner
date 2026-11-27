import { it } from "vitest";
import { Badge } from "./badge";
import { Banner } from "./banner";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Choice, ChoiceGroup } from "./choice-group";
import { PageHeader } from "./page-header";
import { SectionHeading } from "./section-heading";
import { StepIndicator } from "./step-indicator";
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
  // @ts-expect-error a StepIndicator needs its sentence and counts
  <StepIndicator />;
  // @ts-expect-error a PageHeader needs a title
  <PageHeader />;
  // @ts-expect-error a SectionHeading needs a title and says which variant it is
  <SectionHeading />;
  // @ts-expect-error a SectionHeading has no default variant, so each call site chooses
  <SectionHeading title="t" />;
  // @ts-expect-error a ChoiceGroup needs a label and a value
  <ChoiceGroup />;
  // @ts-expect-error a Choice needs a label and a value
  <Choice />;
  // Avatar has no words: it is decorative and the name is written beside it.
  <Avatar />;
}

it("is checked by tsc, not at runtime", () => {});
