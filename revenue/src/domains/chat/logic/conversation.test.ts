import { describe, expect, it } from "vitest";
import { questionLength, requestMessages, type Turn } from "./conversation";

/** `n` turns, a user question first, alternating. */
const turns = (n: number): Turn[] => Array.from({ length: n }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", text: `m${i}` }));

describe("requestMessages", () => {
  it.each([
    { n: 1, kept: 1, first: "m0" },
    { n: 11, kept: 11, first: "m0" },
    { n: 12, kept: 10, first: "m2" },
    { n: 13, kept: 11, first: "m2" },
    { n: 15, kept: 11, first: "m4" },
  ])("keeps $kept of $n turns, from $first", ({ n, kept, first }) => {
    const sent = requestMessages(turns(n));
    expect(sent).toHaveLength(kept);
    expect(sent[0]!.text).toBe(first);
    expect(sent[0]!.role).toBe("user");
    expect(sent.at(-1)).toEqual(turns(n).at(-1));
  });

  it("starts with a user turn even when the list starts with the assistant", () => {
    expect(requestMessages(turns(2).reverse())[0]!.role).toBe("user");
  });
});

describe("questionLength", () => {
  it("counts code points, as the server counts runes", () => {
    expect(questionLength("a😀b")).toBe(3);
    expect("a😀b".length).toBe(4);
  });
});
