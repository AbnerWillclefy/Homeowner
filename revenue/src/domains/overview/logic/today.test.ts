import { describe, expect, it } from "vitest";
import { saoPauloDay } from "./today";

describe("saoPauloDay", () => {
  it("is still yesterday in São Paulo just after midnight UTC", () => {
    expect(saoPauloDay(new Date("2026-12-01T01:30:00Z"))).toBe("2026-11-30");
  });
  it("is the same day once São Paulo has passed midnight", () => {
    expect(saoPauloDay(new Date("2026-12-01T03:00:00Z"))).toBe("2026-12-01");
  });
});
