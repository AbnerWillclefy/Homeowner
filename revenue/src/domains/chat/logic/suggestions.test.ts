import { describe, expect, it } from "vitest";
import { en, ptBR } from "../../../shared/i18n/catalogs";
import { SCREEN_KEYS } from "./screenKeys";
import { suggestionsFor } from "./suggestions";

describe("suggestionsFor", () => {
  it("gives every screen key 2 or 3 suggestions that both catalogs have", () => {
    expect(SCREEN_KEYS).toHaveLength(11);
    for (const key of SCREEN_KEYS) {
      const list = suggestionsFor(key, undefined);
      expect(list.length, `${key} has 2 or 3`).toBeGreaterThanOrEqual(2);
      expect(list.length, `${key} has 2 or 3`).toBeLessThanOrEqual(3);
      for (const s of list) {
        expect(s.key.startsWith(`chat.suggest.${key}.`), `${s.key} belongs to ${key}`).toBe(true);
        expect(ptBR[s.key]).toBeTruthy();
        expect(en[s.key]).toBeTruthy();
      }
    }
  });

  it("names the first Goal on Goals, and asks a generic question without one", () => {
    expect(suggestionsFor("goals", "Viagem Japão")[0]).toEqual({ key: "chat.suggest.goals.named", vars: { goal: "Viagem Japão" } });
    expect(suggestionsFor("goals", undefined)[0]).toEqual({ key: "chat.suggest.goals.1" });
    expect(suggestionsFor("goals", "")[0]).toEqual({ key: "chat.suggest.goals.1" });
  });

  it("leaves the other screens alone when a Goal is known", () => {
    expect(suggestionsFor("bills", "Viagem Japão")).toEqual(suggestionsFor("bills", undefined));
  });
});
