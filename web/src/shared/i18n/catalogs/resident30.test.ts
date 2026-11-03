import { describe, expect, it } from "vitest";
import { createTranslate, type Catalogs } from "../translate";
import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";

const t = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as unknown as Catalogs);

describe("the Resident page count label", () => {
  it("says 30 days, singular for 1 and plural for 5, in English", () => {
    expect(t("en-US", "resident.done30", { count: 1 })).toBe("Task done in 30 days");
    expect(t("en-US", "resident.done30", { count: 5 })).toBe("Tasks done in 30 days");
  });

  it("says 30 dias, singular for 1 and plural for 5, in Portuguese", () => {
    expect(t("pt-BR", "resident.done30", { count: 1 })).toBe("Tarefa concluída em 30 dias");
    expect(t("pt-BR", "resident.done30", { count: 5 })).toBe("Tarefas concluídas em 30 dias");
  });

  it("has an empty state that names 30 days, and no key for 7", () => {
    expect(enUS["resident.empty"]).toContain("30 days");
    expect(ptBR["resident.empty"]).toContain("30 dias");
    expect("resident.done7" in enUS).toBe(false);
    expect("resident.done7" in ptBR).toBe(false);
  });
});
