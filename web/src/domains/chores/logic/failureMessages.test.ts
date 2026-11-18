import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { restrictedMessage } from "./failureMessages";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const demandName = (id: string) => ({ lifting: "Carregar peso", bending: "Agachar" })[id] ?? id;

describe("restrictedMessage", () => {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate("pt-BR", key, params);

  it("names the Resident and each Demand, and advises another choice", () => {
    expect(restrictedMessage(t, "Ana", { restrictedBy: ["lifting", "bending"], restrictedByChore: false }, demandName)).toBe(
      "Ana tem restrição em: Carregar peso, Agachar. Escolha outro morador ou Ninguém.",
    );
  });

  it("says a Restriction on the Chore itself", () => {
    expect(restrictedMessage(t, "Ana", { restrictedBy: [], restrictedByChore: true }, demandName)).toBe(
      "Ana tem restrição neste afazer. Escolha outro morador ou Ninguém.",
    );
  });

  it("is never silent when the server names no reason", () => {
    expect(restrictedMessage(t, "Ana", { restrictedBy: [], restrictedByChore: false }, demandName)).toContain("Ana");
  });
});
