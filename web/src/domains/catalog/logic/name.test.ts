import { describe, expect, it } from "vitest";
import type { Translate } from "../../../shared/i18n";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { CATALOG_IDS, catalogName } from "./name";

const english: Translate = (key) => String(enUS[key]);
const portuguese: Translate = (key) => String(ptBR[key]);

describe("catalogName", () => {
  it("is the localized name when the answers produce one Chore", () => {
    expect(catalogName("clean_bathroom", null, "Clean the bathroom", english)).toBe("Clean the bathroom");
    expect(catalogName("clean_bathroom", null, "Clean the bathroom", portuguese)).toBe("Limpar o banheiro");
  });

  it("appends the instance number when there are several", () => {
    expect(catalogName("clean_bathroom", 2, "Clean the bathroom", english)).toBe("Clean the bathroom 2");
    expect(catalogName("clean_bathroom", 10, "Clean the bathroom", portuguese)).toBe("Limpar o banheiro 10");
  });

  it("falls back to the API's English name for an id this app does not know", () => {
    expect(catalogName("clean_sauna", null, "Clean the sauna", portuguese)).toBe("Clean the sauna");
    expect(catalogName("clean_sauna", 3, "Clean the sauna", portuguese)).toBe("Clean the sauna 3");
  });
});

describe("the Catalog names", () => {
  it("cover exactly the catalog.<id> keys of the message catalogs", () => {
    const keys = Object.keys(enUS)
      .filter((key) => key.startsWith("catalog.") && key.split(".").length === 2)
      .map((key) => key.slice("catalog.".length));
    expect([...CATALOG_IDS].sort()).toEqual(keys.sort());
  });

  it("stay within the API's 100 characters in both languages, even with the largest instance number (20, the yards plus gardens of sweep_yard)", () => {
    for (const id of CATALOG_IDS) {
      for (const t of [english, portuguese]) {
        expect([...catalogName(id, 20, "", t)].length).toBeLessThanOrEqual(100);
      }
    }
  });
});
