import { describe, expect, it } from "vitest";
import { timeAgo } from "./timeAgo";

const now = new Date("2026-11-10T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000;

describe("timeAgo", () => {
  it.each([
    [30_000, "agora"],
    [5 * MIN, "há 5 min."],
    [59 * MIN, "há 59 min."],
    [120 * MIN, "há 2 h"],
    [23 * 60 * MIN, "há 23 h"],
    [3 * 1440 * MIN, "há 3 dias"],
  ])("%i ms ago reads %s", (ms, text) => expect(timeAgo(ago(ms), now, "pt-BR")).toBe(text));

  it("never reads the future", () => expect(timeAgo(ago(-5 * MIN), now, "pt-BR")).toBe("agora"));
});
