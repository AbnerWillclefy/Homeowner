import { it } from "vitest";
import { CategoryTag } from "./category-tag";

// Lives here, not in components/, because core never imports finance (layers.test.ts).
export function requiredProps() {
  // @ts-expect-error a CategoryTag needs a label
  <CategoryTag category="housing" />;
}

it("is checked by tsc, not at runtime", () => {});
