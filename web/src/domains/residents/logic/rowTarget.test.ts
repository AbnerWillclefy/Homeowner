import { describe, expect, it } from "vitest";
import { rowTarget } from "./rowTarget";

describe("rowTarget", () => {
  it("opens Me for the caller's own row", () => {
    expect(rowTarget({ id: "r1", you: true })).toBe("/me");
  });

  it("opens that Resident's page for anyone else", () => {
    expect(rowTarget({ id: "r2", you: false })).toBe("/home/residents/r2");
  });
});
