import { expect, it } from "vitest";
import { progressTone } from "./progress-bar";

it.each([
  [849, "brand"],
  [850, "warning"],
  [1000, "warning"],
  [1001, "danger"],
])("progressTone at %s of 1000 is %s", (value, tone) => {
  expect(progressTone(value, 1000)).toBe(tone);
});
