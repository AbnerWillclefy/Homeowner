// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { ToastContext } from "../../../shared/ui/useToast";
import { CheckInDayLines } from "./CheckInDayLines";
import { CheckInDialog } from "./CheckInDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const i18n = (locale: Locale) => {
  const t: Translate = (key, params) => translate(locale, key, params);
  return { locale, setLocale: () => {}, t };
};

const lines = (locale: Locale, props: Parameters<typeof CheckInDayLines>[0]) =>
  renderToStaticMarkup(createElement(I18nContext.Provider, { value: i18n(locale) }, createElement(CheckInDayLines, props)));

describe("CheckInDayLines", () => {
  it.each([
    ["pt-BR", "5 de 5 planejados"],
    ["en-US", "5 of 5 planned"],
  ] as const)("says the planned Effort against Energy in %s", (locale, text) => {
    expect(lines(locale, { planned: { planned: 5, energy: 5 }, restrictions: [] })).toContain(`>${text}</p>`);
  });

  it("reads an over-plan as it is, with no alarm colour", () => {
    const html = lines("en-US", { planned: { planned: 7, energy: 5 }, restrictions: [] });
    expect(html).toContain(">7 of 5 planned</p>");
    expect(html).not.toMatch(/danger|warning|role=/);
  });

  it.each(["pt-BR", "en-US"] as const)("has no planned line without a plan in %s", (locale) => {
    expect(lines(locale, { planned: null, restrictions: [] })).not.toMatch(/planejados|planned/);
  });

  it.each([
    ["pt-BR", "Não hoje: Carregar peso, Abaixar-se"],
    ["en-US", "Not today: Heavy lifting, Bending"],
  ] as const)("lists the saved Restrictions in %s", (locale, text) => {
    expect(lines(locale, { planned: null, restrictions: ["heavy_lifting", "bending"] })).toContain(`>${text}</p>`);
  });

  it.each([
    ["pt-BR", "Nenhuma restrição hoje"],
    ["en-US", "No restrictions today"],
  ] as const)("says there are none in %s", (locale, text) => {
    expect(lines(locale, { planned: null, restrictions: [] })).toContain(`>${text}</p>`);
  });
});

describe("CheckInDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function open(locale: Locale, planned: { planned: number; energy: number } | null) {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        createElement(
          I18nContext.Provider,
          { value: i18n(locale) },
          createElement(
            ToastContext.Provider,
            { value: { show: vi.fn() } },
            createElement(CheckInDialog, {
              checkIn: { date: "2026-10-26", checkedIn: true, level: "normal", restrictions: ["bending"] },
              demands: ["heavy_lifting", "bending"],
              planned,
              save: async () => null,
              onClose: () => {},
            }),
          ),
        ),
      ),
    );
    return () => act(() => root.unmount());
  }

  it.each([
    ["pt-BR", "5 de 5 planejados", "Não hoje: Abaixar-se"],
    ["en-US", "5 of 5 planned", "Not today: Bending"],
  ] as const)("describes the dialog with the day lines and keeps the four levels in %s", (locale, planned, restrictions) => {
    const close = open(locale, { planned: 5, energy: 5 });
    const dialog = document.querySelector('[role="dialog"]')!;
    const description = document.getElementById(dialog.getAttribute("aria-describedby")!)!;
    expect(description.textContent).toContain(planned);
    expect(description.textContent).toContain(restrictions);
    expect(dialog.querySelectorAll('input[type="radio"]')).toHaveLength(4);
    close();
  });

  it("shows no planned line when there is no plan figure", () => {
    const close = open("en-US", null);
    expect(document.querySelector('[role="dialog"]')!.textContent).not.toMatch(/planned/);
    close();
  });
});
