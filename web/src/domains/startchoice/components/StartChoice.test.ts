// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellContext } from "../../../app/components/ShellContext";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { StartChoice } from "./StartChoice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

beforeEach(() => {
  // Below the tablet breakpoint the Sheet is a drawer, which reads the viewport and watches its size.
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function open(locale: Locale) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const shell = { home: { state: { kind: "ready", home: { allocationTime: "07:00" } } } } as never;
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(
          ShellContext.Provider,
          { value: shell },
          createElement(
            I18nContext.Provider,
            { value: { locale, setLocale: () => {}, t: (key, params) => translate(locale, key, params) } },
            createElement(StartChoice, { onDecided: () => {} }),
          ),
        ),
      ),
    ),
  );
  return () => act(() => root.unmount());
}

describe.each([
  ["pt-BR", "Receber minhas tarefas agora", "Começar amanhã", "O plano de todo dia sai às 7:00. Você pode receber as de hoje agora."],
  ["en-US", "Get my tasks right away", "Start tomorrow", "Every day's plan comes out at 7:00 AM. You can get today's Tasks now."],
] as const)("StartChoice in %s", (locale, now, tomorrow, explain) => {
  it("puts the primary button first, then tomorrow, explains when the plan comes out, and has no ✕", () => {
    const close = open(locale);
    const sheet = document.querySelector('[data-slot="sheet"]')!;
    const footer = [...sheet.querySelectorAll("footer button")];
    expect(footer.map((b) => b.textContent)).toEqual([now, tomorrow]);
    expect(footer[0]!.className).toContain("bg-brand");
    expect(footer[1]!.className).toContain("bg-surface-raised");
    expect(sheet.textContent).toContain(explain);
    expect(sheet.querySelectorAll("header button")).toHaveLength(0);
    close();
  });
});
