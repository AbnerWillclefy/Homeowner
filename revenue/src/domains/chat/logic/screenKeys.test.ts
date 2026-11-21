import { describe, expect, it } from "vitest";
import { ROUTES } from "../../../app/screens";
import { parseFrom, pathOfScreenKey, SCREEN_KEYS, screenKeyOf } from "./screenKeys";

describe("screenKeyOf", () => {
  it("names every route the chat is offered from, and the rest `other`", () => {
    const expected: Record<string, string> = {
      "/": "overview", "/transactions": "transactions", "/bills": "bills", "/card-bills": "card_bills", "/categories": "categories",
      "/categories/:category": "categories", "/pantry": "other", "/pantry/list": "other", "/plan": "other", "/more": "other", "/chat": "other", "/goals": "goals",
      "/net-worth": "net_worth", "/projection": "projection", "/sources": "sources", "/settings": "settings",
    };
    expect(ROUTES.length).toBeGreaterThan(10);
    for (const r of ROUTES) {
      expect(expected[r.path], `${r.path} has an expected key`).toBeDefined();
      expect(screenKeyOf(r.path.replace(":category", "groceries"))).toBe(expected[r.path]);
    }
  });

  it("maps a category drill-down to categories and an unknown path to other", () => {
    expect(screenKeyOf("/categories/groceries")).toBe("categories");
    expect(screenKeyOf("/pantry")).toBe("other");
    expect(screenKeyOf("/toString")).toBe("other");
  });
});

describe("parseFrom", () => {
  it("accepts a listed key and turns a missing or unknown one into other", () => {
    expect(SCREEN_KEYS).toHaveLength(11);
    for (const key of SCREEN_KEYS) expect(parseFrom(key)).toBe(key);
    expect(parseFrom(null)).toBe("other");
    expect(parseFrom("pantry")).toBe("other");
    expect(parseFrom("")).toBe("other");
  });
});

describe("pathOfScreenKey", () => {
  it("is the way back to the screen the chat came from", () => {
    expect(pathOfScreenKey("card_bills")).toBe("/card-bills");
    expect(pathOfScreenKey("net_worth")).toBe("/net-worth");
    expect(pathOfScreenKey("overview")).toBe("/");
    expect(pathOfScreenKey("other")).toBe("/");
    for (const key of SCREEN_KEYS) expect(screenKeyOf(pathOfScreenKey(key))).toBe(key === "other" ? "overview" : key);
  });
});
