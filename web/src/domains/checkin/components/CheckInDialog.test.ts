// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { ToastContext } from "../../../shared/ui/useToast";
import { CheckInDialog } from "./CheckInDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const i18n = (locale: Locale) => {
  const t: Translate = (key, params) => translate(locale, key, params);
  return { locale, setLocale: () => {}, t };
};

describe("CheckInDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  function open(locale: Locale) {
    // Below the tablet breakpoint: the Sheet is a drawer.
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
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
            { value: { show: vi.fn(), dismiss: vi.fn() } },
            createElement(CheckInDialog, {
              checkIn: { date: "2026-10-26", checkedIn: true, level: "normal", restrictions: ["bending"] },
              demands: ["heavy_lifting", "bending"],
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
    ["pt-BR", "Check-in de hoje", "Só hoje, evitar", "Para sempre? Use Restrições, na aba Eu.", "Salvar check-in", "Abaixar-se"],
    ["en-US", "Today's Check-in", "Only today, avoid", "For good? Use Restrictions, on the Me tab.", "Save Check-in", "Bending"],
  ] as const)("is a Sheet with the four levels, the Restrictions as checkboxes and the hint in %s", (locale, title, legend, hint, submit, saved) => {
    const close = open(locale);
    const sheet = document.querySelector('[data-slot="sheet"]')!;
    expect(sheet.querySelector("h2")!.textContent).toBe(title);
    expect(sheet.querySelectorAll('input[type="radio"]')).toHaveLength(4);
    expect(sheet.querySelector('input[type="radio"]:checked')).not.toBeNull();
    const boxes = [...sheet.querySelectorAll('[role="checkbox"]')];
    expect(boxes.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(sheet.querySelector(`label[for="${boxes[1]!.id}"]`)!.textContent).toBe(saved);
    expect(sheet.textContent).toContain(legend);
    expect(sheet.textContent).toContain(hint);
    expect(sheet.querySelector('button[type="submit"]')!.textContent).toBe(submit);
    close();
  });
});
