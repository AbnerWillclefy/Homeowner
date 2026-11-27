import { expect, it } from "vitest";
import { createTranslate, type Catalogs } from "./translate";
import { enUS } from "./catalogs/en-US";
import { ptBR } from "./catalogs/pt-BR";
import type { Translate } from "./context";
import { sectionTitle } from "./sectionTitle";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const t: Translate = (key, params) => translate("pt-BR", key, params);

it("appends the count after a dot, and leaves the title alone at zero or without a count", () => {
  expect(sectionTitle(t, "Cozinha", 2)).toBe("Cozinha · 2");
  expect(sectionTitle(t, "Cozinha", 0)).toBe("Cozinha");
  expect(sectionTitle(t, "Cozinha")).toBe("Cozinha");
});
