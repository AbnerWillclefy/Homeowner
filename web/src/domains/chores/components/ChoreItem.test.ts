// @vitest-environment jsdom
import { act, createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShellContext } from "../../../app/components/ShellContext";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { mountWithI18n } from "../../../shared/ui/testing";
import type { Resident } from "../../residents/api/api";
import { chore } from "../testing/fixtures";
import { ChoreItem } from "./ChoreItem";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const ANA = { id: "r1", you: false, name: "Ana Beatriz", photoUrl: null, initials: "AB", avatarTone: "kitchen" } as Resident;

describe("ChoreItem row", () => {
  const { render, container } = mountWithI18n();

  function show(over: Record<string, unknown>, residents: Resident[] = [ANA], onOpen = () => {}, locale: "pt-BR" | "en-US" = "pt-BR") {
    const t: Translate = (key, params) => translate(locale, key, params);
    const shell = { residents: { byResidentId: (id: string) => residents.find((r) => r.id === id) } };
    render(
      createElement(
        I18nContext.Provider,
        { value: { locale, setLocale: () => {}, t } },
        createElement(ShellContext.Provider, { value: shell as never }, createElement("ul", null, createElement(ChoreItem, { chore: { ...chore("c1", "Lavar a louça"), ...over }, onOpen }))),
      ),
    );
    return container().textContent!;
  }

  it("is one button that opens the Chore, named by the Chore and its facts", () => {
    const onOpen = vi.fn();
    show({}, [ANA], onOpen);
    const buttons = container().querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toContain("Lavar a louça");
    act(() => buttons[0]!.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // The group heading names the Category; the row shows only its tile, as on the Chores artboard.
  it("shows the Category as its chore-colour tile, without its name", () => {
    expect(show({ category: "laundry" })).not.toContain("Roupas");
    expect(container().querySelector(".bg-chore-laundry-soft")).not.toBeNull();
    // The artboard's tile is 32px (`md`), not the 40px `lg`.
    expect(container().querySelector(".bg-chore-laundry-soft")!.className).toContain("size-8");
    // An unknown Category is Other.
    expect(show({ category: "mystery" })).not.toContain("mystery");
    expect(container().querySelector(".bg-chore-other-soft")).not.toBeNull();
  });

  it.each([
    ["pt-BR", "Responsável: Ana Beatriz"],
    ["en-US", "Responsible: Ana Beatriz"],
  ] as const)("names the Responsible Resident in %s", (locale, text) => {
    expect(show({ responsibleResidentId: "r1" }, [ANA], () => {}, locale)).toContain(text);
  });

  it("names nobody for Nobody, for a Resident who left, and while the list is not loaded", () => {
    for (const [id, residents] of [[null, [ANA]], ["gone", [ANA]], ["r1", []]] as const) {
      const text = show({ responsibleResidentId: id }, [...residents]);
      expect(text).not.toContain("Responsável");
      expect(text).not.toContain("Ana");
    }
  });
});
