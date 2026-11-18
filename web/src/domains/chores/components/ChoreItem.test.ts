import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShellContext } from "../../../app/components/ShellContext";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Resident } from "../../residents/api/api";
import { chore } from "../testing/fixtures";
import { ChoreItem } from "./ChoreItem";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const ANA = { id: "r1", you: false, name: "Ana Beatriz", photoUrl: null, initials: "AB", avatarTone: "kitchen" } as Resident;

function render(responsibleResidentId: string | null, residents: Resident[], locale: "pt-BR" | "en-US" = "pt-BR"): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  const shell = { residents: { byResidentId: (id: string) => residents.find((r) => r.id === id) } };
  const props = { chore: { ...chore("c1", "Lavar a louça"), responsibleResidentId }, onEdit: () => {}, onDeleted: () => {} };
  return renderToStaticMarkup(
    createElement(
      I18nContext.Provider,
      { value: { locale, setLocale: () => {}, t } },
      createElement(ShellContext.Provider, { value: shell as never }, createElement(ChoreItem, props)),
    ),
  );
}

describe("ChoreItem responsible Resident", () => {
  it.each([
    ["pt-BR", "Responsável: Ana Beatriz"],
    ["en-US", "Responsible: Ana Beatriz"],
  ] as const)("shows the name and the initials Avatar in %s", (locale, text) => {
    const html = render("r1", [ANA], locale);
    expect(html).toContain(text);
    expect(html).toContain(">AB<");
  });

  it("shows nothing extra for Nobody, for a Resident who left, and while the list is not loaded", () => {
    for (const html of [render(null, [ANA]), render("gone", [ANA]), render("r1", [])]) {
      expect(html).not.toContain("Responsável");
      expect(html).not.toContain("Ana");
    }
  });
});
